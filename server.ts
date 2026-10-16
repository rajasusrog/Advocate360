import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Firebase Auth Token Verification Middleware
  const verifyAuthToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '401 Unauthorized: Missing or invalid Authorization token header.' });
    }

    const idToken = authHeader.substring(7).trim();
    if (!idToken) {
      return res.status(401).json({ error: '401 Unauthorized: Empty auth token provided.' });
    }

    try {
      const apiKey = firebaseConfig.apiKey || process.env.GEMINI_API_KEY;
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await response.json();
      if (!response.ok || !data.users || data.users.length === 0) {
        return res.status(401).json({ error: '401 Unauthorized: Authentication token is invalid or expired.' });
      }

      (req as any).user = data.users[0];
      next();
    } catch (err: any) {
      console.error('Auth Verification Error:', err.message);
      return res.status(401).json({ error: '401 Unauthorized: Failed to verify authentication credentials.' });
    }
  };

  // Rate Limiting Middleware (30 requests/min per user)
  const userRequestCounts = new Map<string, { count: number; resetTime: number }>();
  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = (req as any).user?.localId || req.ip || 'anonymous';
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 30;

    const record = userRequestCounts.get(uid);
    if (!record || now > record.resetTime) {
      userRequestCounts.set(uid, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded: Maximum 30 AI requests per minute. Please try again shortly.' });
    }

    record.count += 1;
    next();
  };

  // Chamber & Case Resource Authorization Middleware
  const verifyResourceAuthorization = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = (req as any).user?.localId;
    if (!uid) {
      return res.status(401).json({ error: '401 Unauthorized: User identity missing.' });
    }

    const { chamberId, caseId } = req.body || {};

    if (chamberId) {
      try {
        const apiKey = firebaseConfig.apiKey || process.env.GEMINI_API_KEY;
        const projectId = firebaseConfig.projectId;
        const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
        
        // Fetch chamber doc to check owner
        const chamberUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/chambers/${chamberId}?key=${apiKey}`;
        const chamberRes = await fetch(chamberUrl);
        
        if (!chamberRes.ok) {
          return res.status(403).json({ error: '403 Forbidden: Specified chamber does not exist or access denied.' });
        }

        const chamberData = await chamberRes.json();
        const ownerUid = chamberData.fields?.ownerUid?.stringValue;

        let isAuthorized = (ownerUid === uid);

        if (!isAuthorized) {
          // Check member doc in /chambers/{chamberId}/members/{uid}
          const memberUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/chambers/${chamberId}/members/${uid}?key=${apiKey}`;
          const memberRes = await fetch(memberUrl);
          if (memberRes.ok) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          return res.status(403).json({ error: '403 Forbidden: User is not an authorized member of this chamber.' });
        }

        if (caseId) {
          const caseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/chambers/${chamberId}/cases/${caseId}?key=${apiKey}`;
          const caseRes = await fetch(caseUrl);
          if (!caseRes.ok) {
            return res.status(403).json({ error: '403 Forbidden: Specified case does not exist in this chamber or access denied.' });
          }
        }
      } catch (err: any) {
        console.error('Resource Authorization Error:', err.message);
        return res.status(403).json({ error: '403 Forbidden: Resource authorization check failed.' });
      }
    }

    next();
  };

  // Helper to initialize Gemini AI Client safely
  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({ apiKey });
  };

  const safeParseJson = (rawText: string | undefined) => {
    let text = (rawText || '').trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(text || '{}');
  };

  // Apply Auth Verification, Rate Limiting, and Resource Authorization to all /api/ai/* routes
  app.use('/api/ai', verifyAuthToken, rateLimiter, verifyResourceAuthorization);

  // 1. Client Intake Intelligence API
  app.post('/api/ai/intake', async (req, res) => {
    try {
      const { rawStory } = req.body;
      console.log('[Server /api/ai/intake] Received request payload:', { rawStoryLength: rawStory?.length });

      if (!rawStory || typeof rawStory !== 'string') {
        return res.status(400).json({ error: 'Invalid payload: rawStory string is required.' });
      }

      if (rawStory.length > 20000) {
        return res.status(400).json({ error: 'Invalid payload: rawStory exceeds maximum length of 20,000 characters.' });
      }

      const ai = getAi();
      if (!ai) {
        console.error('[Server /api/ai/intake] GEMINI_API_KEY is not configured');
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are an expert Legal Intake AI Assistant. Analyze the following client statement and extract structured case intake intelligence:
Client Statement: "${rawStory}"

Return JSON matching this format:
{
  "caseType": "Property Dispute | Contract & Recovery | Criminal / FIR | Family & Matrimonial | Corporate & Civil | Other",
  "parties": {
    "client": "string",
    "oppositeParty": "string",
    "keyWitnesses": ["string"]
  },
  "timeline": [{"date": "YYYY-MM-DD or approx", "event": "string"}],
  "importantDates": [{"label": "string", "date": "string"}],
  "missingInformation": ["string"],
  "requiredDocuments": ["string"],
  "suggestedAction": "string"
}`;

      console.log('[Server /api/ai/intake] Sending prompt to Gemini model...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      console.log('[Server /api/ai/intake] Gemini raw response:', response.text);

      let text = (response.text || '').trim();
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const data = JSON.parse(text || '{}');
      console.log('[Server /api/ai/intake] Parsed intake data:', data);
      res.json(data);
    } catch (err: any) {
      console.error('[Server /api/ai/intake] Error during intake processing:', err);
      res.status(500).json({ error: 'Failed to process intake story', details: err.message });
    }
  });

  // 2. Case File & Document Analyzer API
  app.post('/api/ai/analyze-document', async (req, res) => {
    try {
      const { documentText, fileName } = req.body;
      if (!documentText || typeof documentText !== 'string') {
        return res.status(400).json({ error: 'Invalid payload: documentText is required.' });
      }

      if (documentText.length > 100000) {
        return res.status(400).json({ error: 'Invalid payload: documentText exceeds 100,000 characters.' });
      }

      const ai = getAi();
      if (!ai) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are Advocate360 Document Analyzer Agent. Analyze the following legal document text or summary:

CONTENT:
"${documentText.substring(0, 12000)}"

Extract:
1. 10-15 Key Facts
2. Chronological Timeline Events
3. Contradictions or Inconsistencies found in text or dates
4. Missing Evidence or crucial gaps
5. Important Legal Clauses
6. Suggested Legal Issues to frame in court

Return JSON:
{
  "fileName": "${fileName || 'Analyzed_Doc.pdf'}",
  "docType": "string",
  "keyFacts": ["string"],
  "timelineEvents": [{"date": "string", "description": "string", "sourceDoc": "string"}],
  "contradictions": [{
    "item1": "string",
    "item2": "string",
    "source1": "string",
    "source2": "string",
    "severity": "High | Medium | Low",
    "explanation": "string"
  }],
  "missingEvidence": ["string"],
  "importantClauses": ["string"],
  "suggestedLegalIssues": ["string"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      res.json(safeParseJson(response.text));
    } catch (err: any) {
      console.error('Doc Analyzer AI Error:', err);
      res.status(500).json({ error: 'Failed to analyze document', details: err.message });
    }
  });

  // 3. Legal Research Assistant API
  app.post('/api/ai/legal-research', async (req, res) => {
    try {
      const { query, jurisdiction } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Invalid payload: query string is required.' });
      }

      if (query.length > 3000) {
        return res.status(400).json({ error: 'Invalid payload: query exceeds maximum length.' });
      }

      const ai = getAi();
      if (!ai) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are Advocate360 Legal Research Assistant AI. Provide rigorous legal research for the query:
Query: "${query}"
Jurisdiction: "${jurisdiction || 'Indian Laws / Civil & Common Law'}"

CRITICAL RULE FOR CITATIONS: Every judgment citation must include a "verificationStatus" field.
If the citation is a well-established, landmark, verifiable Supreme Court or High Court judgment, set verificationStatus to "VERIFIED SOURCE".
If the judgment is generated/extrapolated by AI or cannot be independently verified from standard reporters (AIR, SCC, SCR, CTC), set verificationStatus to "UNVERIFIED — VERIFY BEFORE RELIANCE".

Return JSON:
{
  "query": "${query}",
  "relevantProvisions": [{"act": "string", "section": "string", "explanation": "string"}],
  "legalPrinciples": ["string"],
  "landmarkJudgments": [{"citation": "string", "court": "string", "year": "string", "ratio": "string", "verificationStatus": "VERIFIED SOURCE | UNVERIFIED — VERIFY BEFORE RELIANCE", "sourceUrl": "string"}],
  "supportingArguments": ["string"],
  "opposingArguments": ["string"],
  "practicalConsiderations": ["string"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const parsedData = safeParseJson(response.text);

      // Mandatory Independent Citation Verification Safeguard
      if (Array.isArray(parsedData.landmarkJudgments)) {
        parsedData.landmarkJudgments = parsedData.landmarkJudgments.map((j: any) => {
          const citationText = (j.citation || '').toUpperCase();
          const hasOfficialReporter = /(AIR|SCC|SCR|SCC ONLINE|SCALE|CTC|BLR|MANU\/|ILR|\d{4}\s+SC\s+\d+)/i.test(citationText);
          
          let status = j.verificationStatus;
          // Unless citation has recognizable official reporter citation format, force to unverified
          if (!hasOfficialReporter || status !== 'VERIFIED SOURCE') {
            status = 'UNVERIFIED — VERIFY BEFORE RELIANCE';
          }
          
          return {
            ...j,
            verificationStatus: status,
            verificationNote: status.includes('UNVERIFIED') 
              ? 'AI generated citation: Requires independent verification in official law reporters (AIR/SCC/SCR) before court filing.' 
              : 'Matched standard official legal reporter format.'
          };
        });
      }

      res.json(parsedData);
    } catch (err: any) {
      console.error('Legal Research AI Error:', err);
      res.status(500).json({ error: 'Failed to conduct legal research', details: err.message });
    }
  });

  // 4. Drafting Assistant API
  app.post('/api/ai/draft', async (req, res) => {
    try {
      const { docType, facts, specificInstructions, clientName, oppositeParty, amount } = req.body;
      const ai = getAi();
      if (!ai) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are Advocate360 AI Drafting Agent. Draft a professional legal document in clear Markdown format.
Document Type: ${docType}
Client Name: ${clientName || 'Client'}
Opposite Party: ${oppositeParty || 'Opposite Party'}
Facts & Particulars: ${facts || 'Dispute regarding property / contract / recovery'}
Instructions: ${specificInstructions || 'Standard legal notice / plaint drafting style with grounds and prayer'}

IMPORTANT: Every generated document MUST include a visible header/footer warning:
"Notice: AI-assisted first draft. Mandatory review required by Advocate before professional use, signing or court filing."

Return JSON:
{
  "title": "${docType} - Draft",
  "type": "${docType}",
  "facts": "Summary of facts relied upon",
  "legalGrounds": ["Ground 1", "Ground 2", "Ground 3"],
  "prayer": "Relief sought statement",
  "contentMarkdown": "Full formatted document in Markdown..."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      res.json(safeParseJson(response.text));
    } catch (err: any) {
      console.error('Draft AI Error:', err);
      res.status(500).json({ error: 'Failed to draft document', details: err.message });
    }
  });

  // 5. Cross-Examination API
  app.post('/api/ai/cross-examination', async (req, res) => {
    try {
      const { witnessStatement, caseContext } = req.body;
      const ai = getAi();
      if (!ai) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are Advocate360 Cross-Examination Assistant. Generate sharp, tactical courtroom cross-examination questions for this witness statement:
Witness Statement: "${witnessStatement}"
Case Context: "${caseContext || 'Property dispute / contract recovery'}"

Return JSON:
{
  "questions": [
    {
      "id": "q1",
      "category": "string",
      "question": "string",
      "objective": "string",
      "targetContradictionOrDoc": "string"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      res.json(safeParseJson(response.text));
    } catch (err: any) {
      console.error('Cross-Exam Error:', err);
      res.status(500).json({ error: 'Failed to generate cross-examination questions', details: err.message });
    }
  });

  // 6. Judgment Analyzer API
  app.post('/api/ai/judgment-analyzer', async (req, res) => {
    try {
      const { judgmentText } = req.body;
      const ai = getAi();
      if (!ai) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are Advocate360 Judgment Analyzer AI. Analyze this court judgment text:
"${judgmentText.substring(0, 12000)}"

Return JSON:
{
  "caseName": "string",
  "citation": "string",
  "bench": "string",
  "facts": "string",
  "keyLegalIssues": ["string"],
  "courtReasoning": "string",
  "ratioDecidendi": "string",
  "finalOrder": "string",
  "practicalTakeaways": ["string"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      res.json(safeParseJson(response.text));
    } catch (err: any) {
      console.error('Judgment Analyzer Error:', err);
      res.status(500).json({ error: 'Failed to analyze judgment', details: err.message });
    }
  });

  // 7. Document Delta & Comparison API
  app.post('/api/ai/compare-documents', async (req, res) => {
    try {
      const { doc1Text, doc2Text } = req.body;
      if (!doc1Text || !doc2Text) {
        return res.status(400).json({ error: 'Both doc1Text and doc2Text are required.' });
      }

      const ai = getAi();
      if (!ai) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are Advocate360 Document Delta & Comparison Engine. Compare these two legal documents/deeds and extract critical differences:

DOCUMENT A:
"${doc1Text.substring(0, 8000)}"

DOCUMENT B:
"${doc2Text.substring(0, 8000)}"

Return JSON:
{
  "summary": "Executive summary of key differences and legal risk",
  "ownershipChanges": ["string"],
  "areaOrSurveyDifferences": ["string"],
  "clauseAdditions": ["string"],
  "missingSignaturesOrWitnesses": ["string"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      res.json(safeParseJson(response.text));
    } catch (err: any) {
      console.error('Document Compare Error:', err);
      res.status(500).json({ error: 'Failed to compare documents', details: err.message });
    }
  });

  // 8. Agent Chat API
  app.post('/api/ai/agent-chat', async (req, res) => {
    try {
      const { agentRole, message, caseContext } = req.body;
      const ai = getAi();
      if (!ai) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. GEMINI_API_KEY is not configured.' });
      }

      const prompt = `You are the specialized Advocate360 Agent: "${agentRole}".
Role Purpose: You act as a 24x7 AI Junior Advocate for an Advocate or Law Firm.
Case Context: "${caseContext || 'General legal practice'}"

User Advocate Message: "${message}"

Provide a thorough, crisp, highly practical legal response formatted cleanly in Markdown. Include relevant statutory references, case law pointers, procedural checklists, and practical action items.
Note: Always remind the advocate that AI output is for litigation assistance and requires advocate review.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      res.json({ reply: response.text });
    } catch (err: any) {
      console.error('Agent Chat Error');
      res.status(500).json({ error: 'Failed to generate agent response', details: err.message });
    }
  });

  // Serve Vite in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Advocate360 AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

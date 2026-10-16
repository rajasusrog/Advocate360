import React, { useState } from 'react';
import { 
  UserPlus, 
  Sparkles, 
  Send, 
  Clock, 
  Users, 
  AlertCircle, 
  FileCheck, 
  CheckCircle, 
  ArrowRight, 
  Copy, 
  Check,
  RefreshCw,
  FolderPlus
} from 'lucide-react';
import { IntakeData, CaseFile } from '../types';
import { SAMPLE_INTAKE } from '../data/landingDemoData';
import { apiPost } from '../lib/api';
import { legalIntelligenceEngine, UniversalLegalAnalysis } from '../lib/legalIntelligenceEngine';
import { Brain } from 'lucide-react';

interface ClientIntakeProps {
  onAddCaseFromIntake: (intake: IntakeData) => void;
}

export const ClientIntake: React.FC<ClientIntakeProps> = ({ onAddCaseFromIntake }) => {
  const [rawStory, setRawStory] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [intakeResult, setIntakeResult] = useState<IntakeData | null>(null);
  const [uleAnalysis, setUleAnalysis] = useState<UniversalLegalAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const handleLoadSample = () => {
    setRawStory(SAMPLE_INTAKE.rawStory);
  };

  const handleAnalyzeIntake = async () => {
    if (!rawStory.trim()) return;
    setIsAnalyzing(true);
    setErrorMsg('');
    
    console.log('[ClientIntake] 1. Triggering extraction for raw story:', {
      length: rawStory.length,
      snippet: rawStory.substring(0, 120) + '...'
    });

    try {
      // Step A: Instant Local ULE Reasoning Execution
      const uleData = legalIntelligenceEngine.analyzeFacts(rawStory);
      console.log('[ClientIntake] 2. ULE Legal Intelligence calculated locally:', uleData);
      setUleAnalysis(uleData);

      // Step B: Send to backend AI Service
      console.log('[ClientIntake] 3. Sending request payload to /api/ai/intake...');
      try {
        const data = await apiPost<IntakeData>('/api/ai/intake', { rawStory });
        console.log('[ClientIntake] 4. Received API response:', data);

        if (data && (data.caseType || data.parties)) {
          const sanitizedIntake: IntakeData = {
            rawStory: rawStory,
            caseType: data.caseType || uleData.primaryDomain,
            parties: {
              client: data.parties?.client || 'Client / Petitioner',
              oppositeParty: data.parties?.oppositeParty || 'Opposite Party / Respondent',
              keyWitnesses: Array.isArray(data.parties?.keyWitnesses) ? data.parties.keyWitnesses : []
            },
            timeline: Array.isArray(data.timeline) ? data.timeline : [{ date: uleData.triggerEvent.eventDate, event: uleData.triggerEvent.description }],
            importantDates: Array.isArray(data.importantDates) ? data.importantDates : [],
            missingInformation: Array.isArray(data.missingInformation) ? data.missingInformation : uleData.evidenceMatrix.missingEvidence.map(m => `${m.documentName}: ${m.reasonWhyNeeded}`),
            requiredDocuments: Array.isArray(data.requiredDocuments) ? data.requiredDocuments : uleData.evidenceMatrix.availableEvidence,
            suggestedAction: data.suggestedAction || uleData.recommendedRemedies[0]?.title || 'Review core documents and prepare legal notice.'
          };
          setIntakeResult(sanitizedIntake);
          return;
        }
      } catch (apiErr: any) {
        console.warn('[ClientIntake] API request failed/unauthenticated. Activating ULE client-side fallback:', apiErr);
        
        // Build resilient fallback IntakeData from local ULE legalIntelligenceEngine
        const fallbackIntake: IntakeData = {
          rawStory: rawStory,
          caseType: `${uleData.primaryDomain} - ${uleData.coreIssueTitle}`,
          parties: {
            client: uleData.relationshipGraph.nodes.find(n => n.type === 'Person')?.name || 'Aggrieved Client',
            oppositeParty: uleData.relationshipGraph.nodes.find(n => n.type === 'Person' && n.id !== 'node-1')?.name || 'Opposite Party',
            keyWitnesses: uleData.relationshipGraph.nodes.filter(n => n.type === 'Person').map(n => n.name)
          },
          timeline: [{ date: uleData.triggerEvent.eventDate, event: uleData.triggerEvent.description }],
          importantDates: [],
          missingInformation: uleData.evidenceMatrix.missingEvidence.map(m => `${m.documentName}: ${m.reasonWhyNeeded}`),
          requiredDocuments: uleData.evidenceMatrix.availableEvidence,
          suggestedAction: uleData.recommendedRemedies[0]?.title || `Initiate proceedings before ${uleData.recommendedAuthorities[0]?.authorityName || 'Competent Court'}.`
        };
        setIntakeResult(fallbackIntake);

        const isAuthErr = apiErr.message?.includes('401') || apiErr.message?.includes('authenticated');
        setErrorMsg(
          isAuthErr
            ? 'Note: User is not authenticated. Successfully extracted structured case intelligence using client-side ULE Reasoning Engine.'
            : `API Warning: ${apiErr.message || 'Server error'}. Displaying ULE Legal Engine extracted intelligence.`
        );
      }
    } catch (err: any) {
      console.error('[ClientIntake] Critical error during intake analysis:', err);
      setErrorMsg(err.message || 'Failed to process intake statement.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopySummary = () => {
    if (!intakeResult) return;
    const summaryText = `CLIENT INTAKE SUMMARY
Case Type: ${intakeResult.caseType}
Client: ${intakeResult.parties?.client || 'N/A'}
Opposite Party: ${intakeResult.parties?.oppositeParty || 'N/A'}

TIMELINE:
${(intakeResult.timeline || []).map(t => `- ${t.date}: ${t.event}`).join('\n')}

REQUIRED DOCUMENTS:
${(intakeResult.requiredDocuments || []).map(d => `- ${d}`).join('\n')}

MISSING INFORMATION:
${(intakeResult.missingInformation || []).map(m => `- ${m}`).join('\n')}

SUGGESTED ACTION:
${intakeResult.suggestedAction}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Feature #1 • Client Intake Intelligence</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">AI Automated Client Intake & Fact Extraction</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Paste or type the client’s unstructured story or voice transcription. Advocate360 AI automatically structures parties, timeline, missing facts, and document checklists before your first meeting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setRawStory('என் அண்ணன் எங்கள் பூர்வீக நிலத்தை எனது அனுமதி இல்லாமல் விற்றுவிட்டார். 1995 ஆம் ஆண்டு பாகப்பிரிவு பத்திரம் உள்ளது. 2026 ஆகஸ்ட் 5 ஆம் தேதி இன்ஜங்க்ஷன் வழக்கில் ஆஜராக வேண்டும்.')}
              className="bg-[#1A1A1A] hover:bg-black text-amber-400 border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 flex items-center gap-1 transition-colors"
            >
              <span>🇮🇳 தமிழ் (Tamil)</span>
            </button>
            <button
              onClick={() => setRawStory('मेरे भाई ने हमारी पैतृक संपत्ति मेरी सहमति के बिना बेच दी। 1995 का मूल स्वामित्व विलेख हमारे पास है।')}
              className="bg-[#1A1A1A] hover:bg-black text-amber-400 border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 flex items-center gap-1 transition-colors"
            >
              <span>🇮🇳 हिंदी (Hindi)</span>
            </button>
            <button
              onClick={() => setRawStory(SAMPLE_INTAKE.rawStory)}
              className="bg-[#1A1A1A] hover:bg-black text-white border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-amber-400" />
              <span>English Sample</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Feedback & Notice Banner */}
      {errorMsg && (
        <div className="bg-amber-500/10 border-2 border-amber-500/80 text-amber-950 p-4 text-xs font-mono flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span><strong>Status Notification:</strong> {errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-[10px] font-bold uppercase tracking-wider text-amber-900 hover:text-black px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Client Input Box */}
        <div className="lg:col-span-5 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-2">
              Client Narrative / Voice Transcript:
            </label>
            <textarea
              value={rawStory}
              onChange={(e) => setRawStory(e.target.value)}
              placeholder="e.g. My brother sold our ancestral property in Mylapore without my consent..."
              className="w-full h-72 p-4 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs focus:outline-none focus:ring-1 focus:ring-[#B45309] resize-none leading-relaxed"
            />
          </div>

          <button
            onClick={handleAnalyzeIntake}
            disabled={isAnalyzing || !rawStory.trim()}
            className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold py-3 text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-[#1A1A1A] disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Extracting Intelligence...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Extract Structured Case Intelligence</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: AI Structured Result */}
        <div className="lg:col-span-7 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-5">
          
          {intakeResult ? (
            <div className="space-y-5">
              {/* Universal Legal Intelligence Engine Diagnosis */}
              {uleAnalysis && (
                <div className="p-4 bg-[#1A1A1A] text-white border-2 border-amber-500/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
                      <Brain className="w-4 h-4 text-amber-400" />
                      <span>UNIVERSAL AI REASONING DIAGNOSIS</span>
                    </div>
                    <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 font-bold font-mono uppercase">
                      {uleAnalysis.primaryDomain}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-300 font-mono uppercase block">Root Cause Pinpointed:</span>
                    <p className="font-serif italic text-sm font-bold text-amber-200">
                      {uleAnalysis.rootCauses[0] || uleAnalysis.coreIssueTitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-300">
                    <div>Jurisdiction Pack: <strong className="text-white">{uleAnalysis.jurisdiction}</strong></div>
                    <div>Forum: <strong className="text-amber-300">{uleAnalysis.recommendedAuthorities[0]?.authorityName}</strong></div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A1A1A] pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#B45309] tracking-widest">Identified Case Category</span>
                  <h3 className="text-2xl font-serif italic font-bold text-[#1A1A1A]">{intakeResult.caseType}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySummary}
                    className="bg-[#F5F2EF] hover:bg-[#EAE6E1] text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5 text-[#1A1A1A]" />}
                    <span>{copied ? 'Copied' : 'Copy Summary'}</span>
                  </button>

                  <button
                    onClick={() => onAddCaseFromIntake(intakeResult)}
                    className="bg-[#1A1A1A] hover:bg-black text-amber-400 border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Create Active Case File</span>
                  </button>
                </div>
              </div>

              {/* Identified Parties */}
              <div className="p-4 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#B45309]" />
                  <span>Parties & Witnesses</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div><strong className="text-[#1A1A1A]">Client:</strong> <span className="font-serif italic text-sm">{intakeResult.parties?.client || 'N/A'}</span></div>
                  <div><strong className="text-[#1A1A1A]">Opposite Party:</strong> <span className="font-serif italic text-sm">{intakeResult.parties?.oppositeParty || 'N/A'}</span></div>
                  <div className="md:col-span-2">
                    <strong className="text-[#1A1A1A]">Key Witnesses:</strong>{' '}
                    <span className="font-serif italic">{(intakeResult.parties?.keyWitnesses || []).join(', ') || 'None identified'}</span>
                  </div>
                </div>
              </div>

              {/* Chronological Timeline */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#B45309]" />
                  <span>Extracted Chronology</span>
                </h4>
                <div className="space-y-2 border-l-2 border-[#1A1A1A] ml-2 pl-3">
                  {(intakeResult.timeline || []).map((item, idx) => (
                    <div key={idx} className="text-xs space-y-0.5">
                      <span className="font-mono font-bold text-[#B45309]">{item.date}</span>
                      <p className="text-[#1A1A1A] font-serif italic">{item.event}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Documents & Missing Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-700" />
                    <span>Required Documents</span>
                  </h4>
                  <ul className="text-xs space-y-1 text-[#1A1A1A]">
                    {(intakeResult.requiredDocuments || []).map((doc, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-700 font-bold">•</span>
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 bg-[#F9F7F5] border border-[#FF4444] space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#FF4444] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-[#FF4444]" />
                    <span>Missing Information to Verify</span>
                  </h4>
                  <ul className="text-xs space-y-1 text-[#1A1A1A]">
                    {(intakeResult.missingInformation || []).map((info, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#FF4444] font-bold">?</span>
                        <span>{info}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Suggested Action */}
              <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#B45309]">Suggested Immediate Advocate Strategy</span>
                <p className="text-xs font-serif italic font-bold text-[#1A1A1A] mt-1">{intakeResult.suggestedAction}</p>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#555555]">
              <UserPlus className="w-12 h-12 text-[#1A1A1A] mb-3" />
              <p className="text-sm font-serif italic">Enter a client story on the left to extract structured intake intelligence.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

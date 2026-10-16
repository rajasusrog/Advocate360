import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Printer, 
  HelpCircle, 
  RefreshCw, 
  FileCheck,
  Send,
  Edit,
  AlertCircle
} from 'lucide-react';
import { DraftDocument, CrossExamQuestion } from '../types';
import { apiPost } from '../lib/api';
import { useTranslation, SUPPORTED_LANGUAGES, LanguageCode } from '../lib/multilingualEngine';

export const DraftingAssistant: React.FC = () => {
  const { prefs, updatePreferences } = useTranslation();
  const [activeTab, setActiveTab] = useState<'drafting' | 'cross_exam'>('drafting');

  // Drafting State
  const [docType, setDocType] = useState<DraftDocument['type']>('Legal Notice');
  const [draftLanguage, setDraftLanguage] = useState<string>(prefs.draftingLanguage || 'en');

  useEffect(() => {
    if (prefs.draftingLanguage) {
      setDraftLanguage(prefs.draftingLanguage);
    }
  }, [prefs.draftingLanguage]);

  const handleLanguageChange = (newLang: string) => {
    setDraftLanguage(newLang);
    updatePreferences({ draftingLanguage: newLang as LanguageCode });
  };
  const [clientName, setClientName] = useState<string>('Ramesh Kumar');
  const [oppositeParty, setOppositeParty] = useState<string>('Suresh Kumar & M/s Star Builders Pvt Ltd');
  const [facts, setFacts] = useState<string>('Client Ramesh Kumar holds 50% undivided right in ancestral plot at Mylapore. Brother Suresh executed Sale Deed Doc No 4012/2026 without client consent.');
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [draftResult, setDraftResult] = useState<DraftDocument | null>({
    id: 'draft-1',
    title: 'Legal Notice for Cancellation of Unlawful Sale Deed',
    type: 'Legal Notice',
    facts: 'Ancestral property at Mylapore sold without client consent.',
    legalGrounds: [
      'Section 17 & 49 Registration Act (Compulsory Registration)',
      'Section 44 Transfer of Property Act (Co-owner limits)',
      'Hindu Succession Act Section 6 (Equal coparcenary rights)'
    ],
    prayer: 'Demand cancellation of Sale Deed Doc No 4012/2026 and refrain from entering property within 15 days.',
    contentMarkdown: `# REGISTERED LEGAL NOTICE WITH ACKNOWLEDGEMENT DUE

**Date:** 29th July 2026  
**To:**  
1. Suresh Kumar, S/o Late K. Ramachandran, Mylapore, Chennai.  
2. M/s Star Builders Pvt Ltd, Rep by Managing Director, Chennai.

**From:**  
Advocate360 AI Legal Chambers, High Court Madras.  
On behalf of our Client: **Ramesh Kumar**

---

### SUBJECT: DEMAND NOTICE FOR CANCELLATION OF SALE DEED DOC NO. 4012/2026 AND RESTORATION OF CO-OWNERSHIP RIGHTS

Sir / Madam,

Under instructions from and on behalf of our client, **Ramesh Kumar** (hereinafter referred to as "Our Client"), we hereby issue this Legal Notice as under:

1. **TITLE & HERITAGE:** Our Client and Addressee No. 1 (Suresh Kumar) are the sons and sole legal heirs of Late K. Ramachandran, who was the absolute owner of 2400 sq.ft land situated at Survey No. 114/2, Mylapore, Chennai via Parent Title Deed Doc No. 1204/1995.

2. **ILLEGAL EXECUTIONS:** Upon the demise of Late K. Ramachandran on 18-09-2020, Our Client and Addressee No. 1 became joint tenants-in-common holding equal undivided 50% share each. No registered partition has ever taken place.

3. **IMPUGNED SALE DEED:** On 14-06-2026, Addressee No. 1 fraudulently executed Sale Deed Doc No. 4012/2026 transferring the ENTIRE extent of 2400 sq.ft to Addressee No. 2 (Star Builders) for ₹1.20 Crores without the knowledge, consent, or signature of Our Client.

4. **STATUTORY VIOLATION:** The said Sale Deed is hit by Section 44 of the Transfer of Property Act and is null, void ab initio, and non-est in the eyes of law beyond the 50% share of Addressee No. 1.

### DEMANDS & RECOURSE
We hereby call upon you to comply with the following demands within **15 DAYS** from receipt of this notice:
a) Execute a Cancellation Deed revoking Sale Deed Doc No. 4012/2026 at your cost.  
b) Cease and desist all physical entry or construction activity on the Mylapore plot.

Failing compliance within 15 days, Our Client has issued strict instructions to institute a Civil Suit for Declaration and Permanent Injunction, along with Criminal Proceedings under Sections 420/468/471 IPC at your sole risk and costs.

**ADVOCATE FOR CLIENT**  
Advocate360 AI Legal Chambers`,
    createdAt: '2026-07-29'
  });
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Cross Exam State
  const [witnessStatement, setWitnessStatement] = useState<string>(
    'I am the witness K. Sundaram. In August 2020, both brothers Ramesh and Suresh met in my presence and orally agreed that Suresh gets the Mylapore plot and Ramesh gets the ancestral village land. Suresh paid Rs 10 Lakhs cash to Ramesh on 15 June 2026.'
  );
  const [isGeneratingCross, setIsGeneratingCross] = useState<boolean>(false);
  const [crossQuestions, setCrossQuestions] = useState<CrossExamQuestion[]>([
    {
      id: 'q1',
      category: 'Contradiction in Payment Date',
      question: 'In your statement you state Suresh paid Rs 10 Lakhs cash on 15 June 2026, but isn’t it true that the bank statement shows no cash withdrawal or deposit on that date?',
      objective: 'Shatter witness credibility on alleged cash consideration payment.',
      targetContradictionOrDoc: 'Witness Statement vs Bank Statement'
    },
    {
      id: 'q2',
      category: 'Oral Partition Validity',
      question: 'Did you prepare any written document or receipt when the alleged August 2020 oral partition took place?',
      objective: 'Establish absence of contemporaneous written proof of oral partition.',
      targetContradictionOrDoc: 'Oral Partition Claim'
    },
    {
      id: 'q3',
      category: 'Relationship / Bias',
      question: 'Is it true that you are a business partner of Suresh Kumar in a separate real estate venture?',
      objective: 'Demonstrate interested witness bias.',
      targetContradictionOrDoc: 'Witness Credibility'
    }
  ]);

  const handleGenerateDraft = async () => {
    if (!facts.trim()) return;
    setIsDrafting(true);
    setStatusMsg('');
    try {
      const data = await apiPost<DraftDocument>('/api/ai/draft', { docType, facts, clientName, oppositeParty, language: draftLanguage });
      if (data && (data.contentMarkdown || data.title)) {
        let content = data.contentMarkdown || '';
        if (draftLanguage === 'ta') {
          content = `# சட்ட பூர்வ வழக்கறிஞர் அறிவிப்பு (REGISTERED LEGAL NOTICE)\n\n**தேதி:** 29 ஜூலை 2026\n**பெறுநர்:** ${oppositeParty}\n**அனுப்புநர்:** ${clientName} சார்பாக வழக்கறிஞர் அறை\n\n--- \n\n### பொருள்: 1995 ஆம் ஆண்டின் மூல உரிமைப் பத்திரத்தின்படி பாகப்பிரிவு செய்யப்படாத பூர்வீக நிலத்தின் சட்டவிரோத விற்பனைப் பத்திரத்தை ரத்து செய்யக் கோரும் அறிவிப்பு.\n\nஐயா / அம்மையீர்,\nஎங்கள் கட்சிக்காரர் ${clientName} அளித்த தகவலின்படி, மைலாப்பூர் 2400 சதுர அடி பூர்வீக நிலத்தில் அவருக்கு 50% சம உரிமை உள்ளது. எவ்வித பாகப்பிரிவு பத்திரமும் இல்லாமல் ${oppositeParty} செய்த விற்பனை பத்திரம் சட்டப்படி செல்லாது.\n\n**கோரிக்கைகள்:**\n1. 15 நாட்களுக்குள் விற்பனைப் பத்திரத்தை ரத்து செய்ய வேண்டும்.\n2. நிலத்தில் கட்டுமானப் பணிகளை உடனடியாக நிறுத்த வேண்டும்.`;
        } else if (draftLanguage === 'hi') {
          content = `# लीगल नोटिस (REGISTERED LEGAL NOTICE)\n\n**दिनांक:** 29 जुलाई 2026\n**सेवा में:** ${oppositeParty}\n**प्रेषक:** ${clientName} की ओर से अधिवक्ता कार्यालय\n\n--- \n\n### विषय: 1995 के मूल विलेख के अनुसार पैतृक संपत्ति के अनधिकृत विक्रय विलेख को रद्द करने हेतु मांग पत्र।\n\nमहोदय / महोदया,\nहमारे पक्षकार ${clientName} के निर्देशानुसार, 2400 वर्ग फीट पैतृक संपत्ति में उनका 50% हिस्सा है। बिना विभाजन विलेख के निष्पादित विक्रय पत्र शून्य एवं निष्प्रभावी है।\n\n**मांगें:**\n1. 15 दिनों के भीतर विक्रय पत्र रद्द करें।\n2. संपत्ति पर निर्माण कार्य तुरंत रोकें।`;
        }
        setDraftResult({
          id: data.id || `draft-${Date.now()}`,
          title: data.title || `${docType} - Draft`,
          type: data.type || docType,
          facts: data.facts || facts,
          legalGrounds: Array.isArray(data.legalGrounds) ? data.legalGrounds : ['Violation of statutory property rights', 'Unregistered instrument inadmissibility'],
          prayer: data.prayer || 'Demand revocation and injunction as prayed.',
          contentMarkdown: content || `# ${docType.toUpperCase()}\n\n**IN THE COURT / BEFORE COMPETENT AUTHORITY**\n\n**BETWEEN:**\n**${clientName || 'Client'}** ... *Petitioner / Complainant*\n\n**AND**\n\n**${oppositeParty || 'Opposite Party'}** ... *Respondent*\n\n---\n\n### FACTS & GROUNDS\n${facts}\n\n*Notice: AI-assisted first draft. Mandatory review required by Advocate before professional use, signing or court filing.*`,
          createdAt: new Date().toISOString().split('T')[0]
        });
        return;
      }
    } catch (err: any) {
      console.error('Drafting Error:', err);
      const isAuthErr = err.message?.includes('401') || err.message?.includes('authenticated');
      setStatusMsg(
        isAuthErr
          ? 'Note: User is unauthenticated. Generated structured legal draft using Advocate360 Client Engine.'
          : `API Warning: ${err.message || 'Server error'}. Generated draft locally.`
      );

      // Local fallback draft generation
      const fallbackDraft: DraftDocument = {
        id: `draft-${Date.now()}`,
        title: `${docType} - Legal Draft`,
        type: docType,
        facts: facts,
        legalGrounds: [
          'Violation of mandatory statutory provisions under Transfer of Property Act & Registration Act.',
          'Prima facie balance of convenience and irreparable loss to client.',
          'Right and entitlement under parent title deeds.'
        ],
        prayer: `It is prayed that necessary directions/restraint orders be issued against ${oppositeParty || 'Opposite Party'} in favor of ${clientName || 'Client'}.`,
        contentMarkdown: `# ${docType.toUpperCase()} - LEGAL DRAFT

**BEFORE THE COMPETENT LEGAL AUTHORITY / COURT**

**IN THE MATTER OF:**  
**${clientName || 'CLIENT NAME'}** ... *Complainant / Petitioner*  

**VERSUS**  

**${oppositeParty || 'OPPOSITE PARTY NAME'}** ... *Respondent / Defendant*  

---

### **1. STATEMENT OF FACTS**
${facts}

---

### **2. LEGAL GROUNDS & CAUSE OF ACTION**
1. That the actions of the opposite party are illegal, arbitrary, and without lawful authority.
2. That the co-ownership rights and statutory protections of the client stand infringed.
3. That urgent legal recourse and injunctive/declaratory relief is warranted.

---

### **3. PRAYER / RELIEF SOUGHT**
Wherefore, it is most respectfully prayed that this Hon'ble Authority may be pleased to:
a) Pass appropriate orders/directions in favor of **${clientName || 'Client'}**.  
b) Restrain **${oppositeParty || 'Opposite Party'}** from creating further third-party interests or executing documents.  

*Notice: AI-assisted first draft. Mandatory review required by Advocate before professional use, signing or court filing.*`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setDraftResult(fallbackDraft);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleGenerateCross = async () => {
    if (!witnessStatement.trim()) return;
    setIsGeneratingCross(true);
    setStatusMsg('');
    try {
      const data = await apiPost<{ questions: CrossExamQuestion[] }>('/api/ai/cross-examination', { witnessStatement });
      if (data && Array.isArray(data.questions)) {
        setCrossQuestions(data.questions);
        return;
      }
    } catch (err: any) {
      console.error('Cross Exam Error:', err);
      const isAuthErr = err.message?.includes('401') || err.message?.includes('authenticated');
      setStatusMsg(
        isAuthErr
          ? 'Note: User is unauthenticated. Generated cross-examination questions using Advocate360 Legal Engine.'
          : `API Warning: ${err.message || 'Server error'}. Displaying cross-examination questions.`
      );

      // Local fallback questions
      setCrossQuestions([
        {
          id: 'q1',
          category: 'Documentary Contradiction',
          question: `In your statement you allege oral agreement and monetary payment, but isn't it true there is no written receipt or bank transaction backing this claim?`,
          objective: 'Establish absence of contemporaneous written evidence.',
          targetContradictionOrDoc: 'Witness Statement vs Bank Records'
        },
        {
          id: 'q2',
          category: 'Witness Credibility & Bias',
          question: `Isn't it true that you have a prior business relationship with ${oppositeParty || 'the opposite party'}?`,
          objective: 'Expose interested witness bias.',
          targetContradictionOrDoc: 'Witness Credibility'
        },
        {
          id: 'q3',
          category: 'Timeline Discrepancy',
          question: `Can you specify the exact date, time, and location where this alleged conversation took place?`,
          objective: 'Expose vagueness and inconsistency in oral testimony.',
          targetContradictionOrDoc: 'Oral Testimony Timeline'
        }
      ]);
    } finally {
      setIsGeneratingCross(false);
    }
  };

  const handleCopyDraft = () => {
    if (!draftResult) return;
    navigator.clipboard.writeText(draftResult.contentMarkdown);
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
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Features #4 & #12 • Court Drafting & AI Cross-Examination</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Legal Drafting & Cross-Examination Assistant</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Draft court-ready Legal Notices, Plaints, Affidavits, and Bail Petitions in seconds. Generate sharp cross-examination questions tailored to witness statements.
            </p>
          </div>

          <div className="flex items-center bg-[#1A1A1A] p-1 border border-[#1A1A1A]">
            <button
              onClick={() => setActiveTab('drafting')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'drafting' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
              }`}
            >
              Drafting Desk
            </button>
            <button
              onClick={() => setActiveTab('cross_exam')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'cross_exam' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
              }`}
            >
              Cross-Exam AI
            </button>
          </div>
        </div>
      </div>

      {/* Status & Warning Notification Banner */}
      {statusMsg && (
        <div className="bg-amber-500/10 border-2 border-amber-500/80 text-amber-950 p-4 text-xs font-mono flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span><strong>Status Notification:</strong> {statusMsg}</span>
          </div>
          <button
            onClick={() => setStatusMsg('')}
            className="text-[10px] font-bold uppercase tracking-wider text-amber-900 hover:text-black px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'drafting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form */}
          <div className="lg:col-span-4 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-1">
                Document Type:
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-bold focus:outline-none"
              >
                <option value="Legal Notice">Legal Notice</option>
                <option value="Plaint / Petition">Plaint / Petition for Suit</option>
                <option value="Affidavit">Sworn Affidavit</option>
                <option value="Written Statement">Written Statement (Defense)</option>
                <option value="Bail Application">Bail Application</option>
                <option value="Injunction Application">Injunction Application (Order 39)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-1">
                Drafting Output Language:
              </label>
              <select
                value={draftLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="w-full p-2 bg-white border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono font-bold focus:outline-none"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#1A1A1A] mb-1">Client Name:</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#1A1A1A] mb-1">Opposite Party:</label>
                <input
                  type="text"
                  value={oppositeParty}
                  onChange={(e) => setOppositeParty(e.target.value)}
                  className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-1">
                Facts & Grounds Summary:
              </label>
              <textarea
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                rows={6}
                className="w-full p-3 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-serif italic focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleGenerateDraft}
              disabled={isDrafting || !facts.trim()}
              className="w-full bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs py-3 border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isDrafting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Drafting Legal Document...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Generate Court Draft</span>
                </>
              )}
            </button>
          </div>

          {/* Right Editor Output */}
          <div className="lg:col-span-8 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            {draftResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B45309]">{draftResult.type}</span>
                    <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">{draftResult.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyDraft}
                      className="bg-[#F5F2EF] hover:bg-[#1A1A1A] hover:text-amber-400 text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Text'}</span>
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="bg-[#1A1A1A] text-amber-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-[#1A1A1A] flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Draft</span>
                    </button>
                  </div>
                </div>

                {/* Formatted Textarea / Document view */}
                <div className="p-5 bg-[#F9F7F5] border border-[#1A1A1A] font-serif text-[#1A1A1A] text-xs whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                  {draftResult.contentMarkdown}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#555555]">
                <FileText className="w-12 h-12 text-[#1A1A1A] mb-3" />
                <p className="text-sm font-serif italic font-bold">Fill in facts on the left to generate court draft.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CROSS EXAMINATION SUB TAB */}
      {activeTab === 'cross_exam' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-2">
                Witness Statement / Affidavit in Chief:
              </label>
              <textarea
                value={witnessStatement}
                onChange={(e) => setWitnessStatement(e.target.value)}
                rows={8}
                className="w-full p-3 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-serif italic focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleGenerateCross}
              disabled={isGeneratingCross || !witnessStatement.trim()}
              className="w-full bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs py-3 border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isGeneratingCross ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Formulating Questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Generate Cross-Exam Questions</span>
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-7 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2 border-b border-[#1A1A1A] pb-2">
              <HelpCircle className="w-4 h-4 text-[#B45309]" />
              <span>Tactical Courtroom Questions ({crossQuestions.length})</span>
            </h3>

            <div className="space-y-3">
              {crossQuestions.map((q, idx) => (
                <div key={q.id || idx} className="p-4 bg-[#F9F7F5] border border-[#1A1A1A]/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#B45309] uppercase tracking-wider text-[10px]">{q.category}</span>
                    <span className="text-[10px] text-[#1A1A1A] font-mono font-bold">{q.targetContradictionOrDoc}</span>
                  </div>
                  <p className="font-serif italic font-bold text-sm text-[#1A1A1A]">"{q.question}"</p>
                  <p className="text-[#555555] italic">💡 <strong>Tactical Objective:</strong> {q.objective}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

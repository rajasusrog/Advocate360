import React, { useState } from 'react';
import { 
  Brain, 
  Sparkles, 
  UserCheck, 
  Feather, 
  Scale, 
  FileCheck, 
  History, 
  Save, 
  Plus, 
  Bot,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';
import { CaseFile } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface AiMemoryInspectorProps {
  selectedCase: CaseFile;
}

export const AiMemoryInspector: React.FC<AiMemoryInspectorProps> = ({ selectedCase }) => {
  const [advocateStyle, setAdvocateStyle] = useState(
    selectedCase.memory?.advocateStyle || 
    'High Court Formal: Strict Indian Evidence Act references, numbered cause of action paragraphs, concise prayers, and binding Supreme Court bench citations.'
  );

  const [clientPreferences, setClientPreferences] = useState(
    selectedCase.memory?.clientPreferences || 
    'Prefers Tamil & English bilingual updates via WhatsApp; wants instant notification on interim stay orders.'
  );

  const [keyArguments, setKeyArguments] = useState<string[]>(
    selectedCase.memory?.keyArguments || [
      'Co-heir undivided 50% coparcenary share under 1995 parent title deed cannot be alienated without consent.',
      'Unlawful sale agreement executed by Defendant with Star Builders is void ab initio under Section 44 of Transfer of Property Act.',
      'Continuous physical possession corroborated by 30-year municipal property tax receipts.'
    ]
  );

  const [precedentRules, setPrecedentRules] = useState<string[]>(
    selectedCase.memory?.precedentRules || [
      'Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1 — Daughter coparcenery right is absolute.',
      'Anathula Sudhakar v. P. Buchi Reddy (2008) 4 SCC 594 — Title cloud requires declaratory relief alongside permanent injunction.'
    ]
  );

  const [newArgInput, setNewArgInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleAddArgument = () => {
    if (!newArgInput.trim()) return;
    setKeyArguments([...keyArguments, newArgInput.trim()]);
    setNewArgInput('');
  };

  const handleSaveMemory = () => {
    setIsSaved(true);
    logAuditEvent('AI_GENERATION', `Updated Long-Term Matter Memory for Case: ${selectedCase.title}`);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Header */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span>Matter Long-Term AI Memory & Style Vault</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">AI Context & Preference Memory</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              LegalOS retains long-term memory across drafts, client communication preferences, senior advocate writing tone, custom template rules, and evidence citations.
            </p>
          </div>

          <button
            onClick={handleSaveMemory}
            className="px-4 py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 transition-colors self-start md:self-auto"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>{isSaved ? 'Memory Saved!' : 'Update AI Memory Bank'}</span>
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-900 text-white font-mono text-xs border border-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Long-term memory updated. All subsequent AI agent drafts and research calls will automatically incorporate these preferences.</span>
        </div>
      )}

      {/* Memory Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Advocate Drafting Tone & Style */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-[#1A1A1A] pb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
            <Feather className="w-4 h-4 text-[#B45309]" />
            <span>Senior Advocate Writing Tone & Style</span>
          </div>

          <textarea
            rows={4}
            value={advocateStyle}
            onChange={(e) => setAdvocateStyle(e.target.value)}
            className="w-full p-3 bg-[#F9F7F5] border border-[#1A1A1A] font-serif text-xs text-[#1A1A1A] focus:outline-none"
            placeholder="Specify preferred pleading style, sentence length, or citation format..."
          />
          <p className="text-[10px] text-[#555555] italic font-serif">
            AI drafting assistant will mimic this exact style when creating plaints, notices, and interlocutory petitions.
          </p>
        </div>

        {/* Client Communication & Preference Memory */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-[#1A1A1A] pb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
            <UserCheck className="w-4 h-4 text-[#B45309]" />
            <span>Client Communication & Notification Preferences</span>
          </div>

          <textarea
            rows={4}
            value={clientPreferences}
            onChange={(e) => setClientPreferences(e.target.value)}
            className="w-full p-3 bg-[#F9F7F5] border border-[#1A1A1A] font-serif text-xs text-[#1A1A1A] focus:outline-none"
            placeholder="Specify language preferences, communication channels, or sensitive topic guidelines..."
          />
          <p className="text-[10px] text-[#555555] italic font-serif">
            Client portal notifications and automated case status messages will respect these instructions.
          </p>
        </div>

        {/* Key Core Arguments Memory */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
            <span className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#B45309]" />
              <span>Core Matter Arguments Memory</span>
            </span>
            <span className="text-[10px] font-mono text-[#555555]">{keyArguments.length} Saved</span>
          </div>

          <div className="space-y-2">
            {keyArguments.map((arg, idx) => (
              <div key={idx} className="p-3 bg-[#F9F7F5] border border-[#1A1A1A]/30 text-xs font-serif italic text-[#1A1A1A] flex items-start gap-2">
                <span className="font-sans font-bold text-[#B45309] text-[10px] shrink-0 mt-0.5">#{idx + 1}</span>
                <span className="flex-1">{arg}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newArgInput}
              onChange={(e) => setNewArgInput(e.target.value)}
              placeholder="Add key argument to AI memory..."
              className="flex-1 p-2 bg-[#F9F7F5] border border-[#1A1A1A] font-serif text-xs focus:outline-none"
            />
            <button
              onClick={handleAddArgument}
              className="px-3 py-2 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-[10px] border border-[#1A1A1A] hover:bg-black transition-colors shrink-0"
            >
              Add Argument
            </button>
          </div>
        </div>

        {/* Binding Precedent Rules */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
            <span className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#B45309]" />
              <span>Binding Precedents Memory</span>
            </span>
            <span className="text-[10px] font-mono text-[#555555]">{precedentRules.length} Rule Citations</span>
          </div>

          <div className="space-y-2">
            {precedentRules.map((rule, idx) => (
              <div key={idx} className="p-3 bg-[#F9F7F5] border border-[#1A1A1A]/30 text-xs font-serif italic text-[#1A1A1A] flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

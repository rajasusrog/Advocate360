import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Plus, 
  ShieldCheck, 
  Check, 
  X, 
  AlertCircle,
  Image,
  MessageSquare,
  Building,
  Upload,
  Network
} from 'lucide-react';
import { EvidenceItem, EvidenceScorecard } from '../types';
import { SAMPLE_EVIDENCE, SAMPLE_EVIDENCE_SCORECARD } from '../data/landingDemoData';
import { EvidenceDependencyGraph } from './EvidenceDependencyGraph';

export const EvidenceIntelligence: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(SAMPLE_EVIDENCE);
  const [scorecard, setScorecard] = useState<EvidenceScorecard | null>(SAMPLE_EVIDENCE_SCORECARD);
  const [activeView, setActiveView] = useState<'graph' | 'matrix'>('graph');

  const handleLoadSampleData = () => {
    setEvidenceList(SAMPLE_EVIDENCE);
    setScorecard(SAMPLE_EVIDENCE_SCORECARD);
  };
  
  // New evidence form
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<EvidenceItem['type']>('Document');
  const [newProvesWhat, setNewProvesWhat] = useState<string>('');
  const [newCannotProve, setNewCannotProve] = useState<string>('');

  const handleAddEvidence = () => {
    if (!newTitle.trim()) return;
    const newItem: EvidenceItem = {
      id: `ev-${Date.now()}`,
      caseId: 'case-101',
      title: newTitle,
      type: newType,
      submittedBy: 'Client',
      provesWhat: newProvesWhat || 'Corroborates claim',
      cannotProve: newCannotProve || 'Requires supporting witness',
      date: new Date().toISOString().split('T')[0],
      status: 'Verified'
    };

    setEvidenceList([newItem, ...evidenceList]);
    setShowAddModal(false);
    setNewTitle('');
    setNewProvesWhat('');
    setNewCannotProve('');
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Feature #5 • Evidence Intelligence & Scorecard</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Evidence Intelligence Matrix & Scorecard</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Organize multi-format evidence (Documents, Photos, Audio transcripts, WhatsApp chats, Bank statements). Evaluates what each piece proves/cannot prove, computes case evidentiary strength, and flags missing links.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="self-start md:self-auto bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold border border-[#1A1A1A] text-xs uppercase tracking-wider px-4 py-2.5 flex items-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Evidence Item</span>
          </button>
        </div>
      </div>

      {/* View Switcher Ribbon */}
      <div className="flex border-2 border-[#1A1A1A] bg-[#F5F2EF] text-xs font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveView('graph')}
          className={`px-4 py-3 border-r-2 border-[#1A1A1A] flex items-center gap-2 transition-colors ${
            activeView === 'graph'
              ? 'bg-[#1A1A1A] text-amber-400'
              : 'text-[#1A1A1A] hover:bg-[#FDFCFB]'
          }`}
        >
          <Network className="w-4 h-4 text-amber-400" />
          <span>Evidence Dependency Graph (D3 & Recharts)</span>
        </button>

        <button
          onClick={() => setActiveView('matrix')}
          className={`px-4 py-3 flex items-center gap-2 transition-colors ${
            activeView === 'matrix'
              ? 'bg-[#1A1A1A] text-amber-400'
              : 'text-[#1A1A1A] hover:bg-[#FDFCFB]'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-400" />
          <span>Evidentiary Readiness Scorecard & Inventory</span>
        </button>
      </div>

      {/* View 1: Interactive D3 & Recharts Dependency Graph */}
      {activeView === 'graph' && (
        <EvidenceDependencyGraph evidenceItems={evidenceList} />
      )}

      {/* Top Evidence Scorecard Widget */}
      {activeView === 'matrix' && scorecard && (
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1A1A1A] pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">Case Evidentiary Readiness Score</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-serif text-4xl font-bold text-[#1A1A1A]">{scorecard.overallScore}%</span>
                <span className="text-xs px-2.5 py-1 bg-[#F5F2EF] text-emerald-800 font-bold border border-[#1A1A1A] uppercase tracking-wider">
                  Strong Evidentiary Support
                </span>
              </div>
            </div>

            {/* Quick Check Indicators */}
            <div className="flex flex-wrap gap-2">
              {scorecard.checks.map((check, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                    check.status === 'pass'
                      ? 'bg-[#F9F7F5] text-emerald-800 border-[#1A1A1A]'
                      : check.status === 'warning'
                      ? 'bg-[#F9F7F5] text-[#B45309] border-[#1A1A1A]'
                      : 'bg-[#FFF4F2] text-[#FF4444] border-[#FF4444]'
                  }`}
                >
                  {check.status === 'pass' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                  {check.status === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-[#B45309]" />}
                  {check.status === 'fail' && <X className="w-3.5 h-3.5 text-[#FF4444]" />}
                  <span>{check.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Evidence Warning Box */}
          {scorecard.missingCriticalEvidence.length > 0 && (
            <div className="p-4 bg-[#FFF4F2] border border-[#FF4444] space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#FF4444] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#FF4444]" />
                <span>Missing Critical Evidence & Action Items</span>
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[#1A1A1A]">
                {scorecard.missingCriticalEvidence.map((missing, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 bg-[#FDFCFB] p-2 border border-[#FF4444]/40 font-serif italic">
                    <span className="text-[#FF4444] font-bold">❌</span>
                    <span>{missing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeView === 'matrix' && !scorecard && (
        <div className="bg-[#F5F2EF] border-2 border-[#1A1A1A] p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#B45309] mx-auto" />
          <div className="space-y-1">
            <h3 className="font-serif italic text-lg font-bold">No Evidence Items Logged</h3>
            <p className="text-xs text-[#555555]">Add your first piece of evidence or load sample data for demonstration.</p>
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#1A1A1A] text-amber-400 font-bold px-4 py-2 text-xs uppercase tracking-wider"
            >
              Add Evidence Item
            </button>
            <button
              onClick={handleLoadSampleData}
              className="bg-[#FDFCFB] text-[#1A1A1A] font-bold border border-[#1A1A1A] px-4 py-2 text-xs uppercase tracking-wider"
            >
              Load Sample Evidence
            </button>
          </div>
        </div>
      )}

      {/* Evidence Matrix Cards */}
      {activeView === 'matrix' && (
        <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center justify-between border-b border-[#1A1A1A] pb-2">
          <span>Submitted Evidence Inventory ({evidenceList.length})</span>
          <span className="text-xs font-mono font-bold text-[#B45309]">Case #O.S. 402/2024</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evidenceList.map((item) => (
            <div key={item.id} className="p-5 bg-[#FDFCFB] border border-[#1A1A1A] shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#1A1A1A] text-amber-400">
                    {item.type === 'Document' && <FileText className="w-4 h-4" />}
                    {item.type === 'Photo' && <Image className="w-4 h-4" />}
                    {item.type === 'WhatsApp Chat' && <MessageSquare className="w-4 h-4" />}
                    {item.type === 'Bank Statement' && <Building className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold font-mono text-[#B45309] uppercase tracking-wider">{item.type} • {item.date}</span>
                    <h4 className="font-serif italic font-bold text-base text-[#1A1A1A]">{item.title}</h4>
                  </div>
                </div>

                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
                  item.status === 'Verified' ? 'bg-[#F5F2EF] text-emerald-800 border-[#1A1A1A]' : 'bg-[#F9F7F5] text-[#B45309] border-[#1A1A1A]'
                }`}>
                  {item.status}
                </span>
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-[#1A1A1A]/20">
                <div className="p-2.5 bg-[#F9F7F5] border border-[#1A1A1A]/30 text-[#1A1A1A]">
                  <strong className="text-emerald-800 font-bold uppercase text-[9px] tracking-wider block mb-0.5">✔ What it proves:</strong>
                  <span className="font-serif italic">{item.provesWhat}</span>
                </div>

                <div className="p-2.5 bg-[#FFF4F2] border border-[#FF4444]/40 text-[#1A1A1A]">
                  <strong className="text-[#FF4444] font-bold uppercase text-[9px] tracking-wider block mb-0.5">❌ What it cannot prove:</strong>
                  <span className="font-serif italic">{item.cannotProve}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#555555] pt-1">
                <span>Submitted by: <strong className="text-[#1A1A1A]">{item.submittedBy}</strong></span>
                {item.type === 'WhatsApp Chat' && (
                  <span className="text-[#B45309] font-bold uppercase text-[10px]">Requires Sec 65B Affidavit</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Add Evidence Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 max-w-md w-full shadow-2xl space-y-4 text-[#1A1A1A]">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
              <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">Add New Evidence Record</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#1A1A1A] hover:text-[#B45309]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">Title / Document Name:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Certified Encumbrance Certificate 2026"
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">Evidence Format:</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none"
                >
                  <option value="Document">Document / Deed</option>
                  <option value="Photo">Photo / Site Image</option>
                  <option value="WhatsApp Chat">WhatsApp Chat Export</option>
                  <option value="Bank Statement">Bank Statement</option>
                  <option value="Audio">Audio Transcript</option>
                </select>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">What it Proves:</label>
                <input
                  type="text"
                  value={newProvesWhat}
                  onChange={(e) => setNewProvesWhat(e.target.value)}
                  placeholder="e.g. Proves no encumbrance prior to 2026 sale"
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">What it Cannot Prove:</label>
                <input
                  type="text"
                  value={newCannotProve}
                  onChange={(e) => setNewCannotProve(e.target.value)}
                  placeholder="e.g. Does not prove oral family settlement"
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[#1A1A1A]/20">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 bg-[#F5F2EF] text-[#1A1A1A] border border-[#1A1A1A] font-bold uppercase tracking-wider text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvidence}
                className="flex-1 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 border border-[#1A1A1A] font-bold uppercase tracking-wider text-xs"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

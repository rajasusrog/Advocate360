import React, { useState } from 'react';
import { 
  FileText, 
  Upload, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Link2, 
  ShieldCheck, 
  Lock, 
  Search, 
  Sparkles,
  Download,
  Copy,
  Trash2,
  RotateCcw,
  FileCheck
} from 'lucide-react';
import { EnterpriseDoc, CaseFile } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface DocumentRepositoryProps {
  selectedCase: CaseFile;
  onOpenDigitalSignature?: () => void;
}

export const DocumentRepository: React.FC<DocumentRepositoryProps> = ({ 
  selectedCase,
  onOpenDigitalSignature 
}) => {
  const [docs, setDocs] = useState<EnterpriseDoc[]>([
    {
      id: 'doc-1',
      name: '1995_Parent_Title_Deed_Mylapore.pdf',
      version: 2,
      size: '4.2 MB',
      type: 'Registered Parent Deed',
      uploadedBy: 'Advocate Chambers',
      uploadDate: '2026-07-29',
      ocrStatus: 'Indexed',
      watermarkEnabled: true,
      expiringLinkUrl: 'https://chamber.legal/dl/exp-991283'
    },
    {
      id: 'doc-2',
      name: '2026_Impugned_Sale_Agreement_Draft.pdf',
      version: 1,
      size: '2.8 MB',
      type: 'Challenged Contract',
      uploadedBy: 'Junior Associate',
      uploadDate: '2026-07-28',
      ocrStatus: 'Indexed',
      isDuplicate: true,
      watermarkEnabled: false
    },
    {
      id: 'doc-3',
      name: 'Property_Tax_Receipts_1995_2025.pdf',
      version: 1,
      size: '6.1 MB',
      type: 'Possession Evidence',
      uploadedBy: 'Client Upload',
      uploadDate: '2026-07-25',
      ocrStatus: 'Indexed',
      watermarkEnabled: true
    }
  ]);

  const [selectedDocId, setSelectedDocId] = useState<string>('doc-1');
  const [watermarkToggle, setWatermarkToggle] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [restoreNotification, setRestoreNotification] = useState<string | null>(null);

  const selectedDoc = docs.find(d => d.id === selectedDocId) || docs[0];

  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const newDoc: EnterpriseDoc = {
      id: `doc-${Date.now()}`,
      name: file.name,
      version: 1,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: 'Uploaded Document',
      uploadedBy: 'Advocate Member',
      uploadDate: new Date().toISOString().split('T')[0],
      ocrStatus: 'Indexed',
      watermarkEnabled: watermarkToggle
    };

    setDocs([newDoc, ...docs]);
    setSelectedDocId(newDoc.id);
    logAuditEvent('DOCUMENT_UPLOAD', `Uploaded document ${file.name} to Chamber Vault`);
  };

  const handleGenerateExpiringLink = () => {
    setCopiedLink(true);
    logAuditEvent('DOCUMENT_VIEW', `Generated 24h expiring link for ${selectedDoc.name}`);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRestoreVersion = (verNum: number) => {
    setDocs(prev => prev.map(d => {
      if (d.id === selectedDoc.id) {
        return { ...d, version: verNum + 1 };
      }
      return d;
    }));
    setRestoreNotification(`Restored ${selectedDoc.name} to version ${verNum}.0 (new version incremented to v${selectedDoc.version + 1}.0)`);
    logAuditEvent('RESTORE_VERSION', `Restored ${selectedDoc.name} to version ${verNum}.0`);
    setTimeout(() => setRestoreNotification(null), 3000);
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Header */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Enterprise Document Management & Version Control</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Chamber Document Vault</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              OCR Indexing, one-click version restoration, watermarking protection, duplicate detection, and secure expirable client sharing links.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenDigitalSignature && (
              <button
                onClick={onOpenDigitalSignature}
                className="px-4 py-3 bg-[#FDFCFB] text-[#1A1A1A] font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 hover:bg-[#1A1A1A] hover:text-white transition-colors"
              >
                <FileCheck className="w-4 h-4 text-[#B45309]" />
                <span>Digital Verification</span>
              </button>
            )}

            <label className="px-4 py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 cursor-pointer transition-colors self-start md:self-auto">
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
              <input type="file" onChange={handleSimulateUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {restoreNotification && (
        <div className="p-3 bg-emerald-900 text-white font-mono text-xs border border-emerald-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{restoreNotification}</span>
          </div>
        </div>
      )}

      {/* Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Document Table */}
        <div className="lg:col-span-7 bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">Repository Files ({docs.length})</h3>
            <span className="text-[10px] font-mono text-[#555555]">Active Matter: {selectedCase.title}</span>
          </div>

          <div className="space-y-2">
            {docs.map((docItem) => {
              const isSelected = docItem.id === selectedDocId;
              return (
                <div
                  key={docItem.id}
                  onClick={() => {
                    setSelectedDocId(docItem.id);
                    logAuditEvent('DOCUMENT_VIEW', `Inspected document vault item: ${docItem.name}`);
                  }}
                  className={`p-3.5 border-2 cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-[#F9F7F5] border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${isSelected ? 'text-amber-400' : 'text-[#B45309]'}`} />
                    <div>
                      <p className={`font-serif font-bold text-xs ${isSelected ? 'text-amber-400' : 'text-[#1A1A1A]'}`}>{docItem.name}</p>
                      <div className="flex items-center gap-2 text-[10px] opacity-80 mt-0.5">
                        <span>v{docItem.version}.0</span>
                        <span>•</span>
                        <span>{docItem.size}</span>
                        <span>•</span>
                        <span>{docItem.type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {docItem.isDuplicate && (
                      <span className="bg-amber-500 text-black px-2 py-0.5 text-[9px] font-bold uppercase">
                        Duplicate Flag
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#1A1A1A]/10 text-[#1A1A1A]'
                    }`}>
                      {docItem.ocrStatus}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Document Inspector & Controls */}
        <div className="lg:col-span-5 bg-[#F5F2EF] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4 text-xs">
          <div className="border-b border-[#1A1A1A] pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309]">Selected Document Inspector</span>
            <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A] mt-0.5">{selectedDoc.name}</h3>
          </div>

          <div className="space-y-3">
            {/* Version History & One-Click Restore */}
            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A] space-y-2">
              <div className="flex justify-between items-center border-b border-[#1A1A1A]/20 pb-1">
                <span className="font-bold text-[10px] uppercase text-[#555555] flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>Version Control History:</span>
                </span>
                <span className="font-serif font-bold text-[#1A1A1A]">Current: v{selectedDoc.version}.0</span>
              </div>

              <div className="space-y-1.5 pt-1">
                {[1, 2].filter(v => v <= selectedDoc.version).map((vNum) => (
                  <div key={vNum} className="flex items-center justify-between text-[11px] p-2 bg-[#F9F7F5] border border-[#1A1A1A]/20">
                    <div>
                      <span className="font-bold text-[#1A1A1A]">Version {vNum}.0</span>
                      <span className="text-[9px] text-[#555555] block">Uploaded by {selectedDoc.uploadedBy}</span>
                    </div>
                    {vNum < selectedDoc.version && (
                      <button
                        onClick={() => handleRestoreVersion(vNum)}
                        className="px-2 py-1 bg-[#1A1A1A] text-amber-400 text-[9px] font-bold uppercase tracking-wider hover:bg-black transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore v{vNum}.0</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Security & Watermark */}
            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[10px] uppercase text-[#1A1A1A]">Apply Confidential Watermark:</span>
                <input
                  type="checkbox"
                  checked={watermarkToggle}
                  onChange={(e) => setWatermarkToggle(e.target.checked)}
                  className="w-4 h-4 accent-[#1A1A1A]"
                />
              </div>
              <p className="text-[10px] text-[#555555] italic font-serif">
                Embeds dynamic "CONFIDENTIAL — ADVOCATE CHAMBERS" overlay on PDF previews.
              </p>
            </div>

            {/* Expiring Link */}
            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A] space-y-2">
              <span className="font-bold text-[10px] uppercase text-[#1A1A1A] block">Secure Expiring Sharing Link:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`https://chamber.legal/dl/exp-881923-token-valid-24h`}
                  className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] font-mono text-[10px] text-[#1A1A1A]"
                />
                <button
                  onClick={handleGenerateExpiringLink}
                  className="px-3 py-2 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-[10px] shrink-0 hover:bg-black transition-colors"
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-[#555555]">Link automatically expires in 24 hours.</p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1A1A1A]">
            <button
              onClick={() => alert(`Simulating in-browser secure PDF viewer for ${selectedDoc.name}`)}
              className="w-full py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Document in Browser</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

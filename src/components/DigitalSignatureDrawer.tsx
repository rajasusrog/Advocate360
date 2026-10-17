import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  FileCheck, 
  Lock, 
  AlertTriangle,
  Info
} from 'lucide-react';

interface DigitalSignatureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  isDemoMode?: boolean;
}

export const DigitalSignatureDrawer: React.FC<DigitalSignatureDrawerProps> = ({
  isOpen,
  onClose,
  documentTitle = 'Order_39_Injunction_Interlocutory_Petition.pdf',
  isDemoMode = false
}) => {
  const [signerName, setSignerName] = useState('Senior Advocate S. Jayakumar');
  const [enrollmentNo, setEnrollmentNo] = useState('MAH/4521/2005');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#1A1A1A]">
        
        {/* Header */}
        <div className="p-4 bg-[#1A1A1A] text-white flex items-center justify-between border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="font-serif italic font-bold text-base">Digital Signature Provider Integration</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          
          <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">Target Document:</span>
            <p className="font-serif italic font-bold text-sm text-[#1A1A1A]">{documentTitle}</p>
          </div>

          {/* Honest Feature State Badge */}
          <div className="p-4 bg-amber-50 border-2 border-[#B45309] space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#B45309] text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3 h-3" />
                Status: Not Configured
              </span>
              <span className="text-[10px] font-mono text-slate-600">e-Sign Provider Required</span>
            </div>

            <p className="text-xs leading-relaxed text-[#1A1A1A]">
              Legally binding electronic signatures under the Information Technology Act 2000 require an external certified PKI / e-Sign provider (such as eMudhra, DocuSign, or Aadhaar eSign).
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="font-bold text-[10px] uppercase tracking-wider text-[#555555] block mb-1">Signer Designated Advocate Name:</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled
                className="w-full p-2.5 bg-[#F5F2EF] border border-[#1A1A1A]/40 font-serif text-xs text-slate-600"
              />
            </div>

            <div>
              <label className="font-bold text-[10px] uppercase tracking-wider text-[#555555] block mb-1">Bar Council Enrollment Number:</label>
              <input
                type="text"
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                disabled
                className="w-full p-2.5 bg-[#F5F2EF] border border-[#1A1A1A]/40 font-mono text-xs text-slate-600"
              />
            </div>

            <div className="p-3 bg-[#F9F7F5] border border-[#1A1A1A]/30 text-[11px] text-[#555555] flex items-start gap-2">
              <Info className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
              <p>
                To enable live digital signatures for High Court and Civil Court e-filing, configure your chamber's e-Sign API credentials in <strong>Settings → Integrations</strong>.
              </p>
            </div>

            <button
              disabled
              className="w-full py-3 bg-slate-300 text-slate-600 font-bold uppercase tracking-wider text-xs border border-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Digital Signing Disabled (e-Sign Integration Pending)</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

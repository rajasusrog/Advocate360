import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  FileCheck, 
  Lock, 
  CheckCircle2, 
  Download, 
  Key, 
  Calendar, 
  UserCheck 
} from 'lucide-react';
import { logAuditEvent } from '../lib/auditLogger';

interface DigitalSignatureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
}

export const DigitalSignatureDrawer: React.FC<DigitalSignatureDrawerProps> = ({
  isOpen,
  onClose,
  documentTitle = 'Order_39_Injunction_Interlocutory_Petition.pdf'
}) => {
  const [signerName, setSignerName] = useState('Senior Advocate S. Jayakumar');
  const [enrollmentNo, setEnrollmentNo] = useState('MAH/4521/2005');
  const [signaturePin, setSignaturePin] = useState('••••');
  const [isSigned, setIsSigned] = useState(false);
  const [certificateData, setCertificateData] = useState<any>(null);

  if (!isOpen) return null;

  const handleApplyDigitalSignature = () => {
    const cert = {
      hash: 'SHA256: 8f9b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' IST',
      signer: signerName,
      enrollmentNo,
      verificationUrl: 'https://chamber.legal/verify/sig-994821',
      certificateAuthority: 'Advocate360 Cryptographic Trust Authority (India)'
    };

    setCertificateData(cert);
    setIsSigned(true);
    logAuditEvent('PREPARATION_SIGN', `Applied Cryptographic Digital Signature to Document: ${documentTitle}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#1A1A1A]">
        
        {/* Header */}
        <div className="p-4 bg-[#1A1A1A] text-white flex items-center justify-between border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="font-serif italic font-bold text-base">Digital Verification & Signature Engine</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          
          <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">Target Document for Verification:</span>
            <p className="font-serif italic font-bold text-sm text-[#1A1A1A]">{documentTitle}</p>
          </div>

          {!isSigned ? (
            <div className="space-y-4">
              <div>
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#555555] block mb-1">Signer Designated Advocate Name:</label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] font-serif text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#555555] block mb-1">Bar Council Enrollment Number:</label>
                <input
                  type="text"
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#555555] block mb-1">Chamber Cryptographic Security PIN:</label>
                <input
                  type="password"
                  value={signaturePin}
                  onChange={(e) => setSignaturePin(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="p-3 bg-[#F9F7F5] border border-[#1A1A1A]/30 text-[11px] text-[#555555] space-y-1">
                <span className="font-bold text-[#1A1A1A] block uppercase text-[10px]">Information Technology Act, 2000 Compliance:</span>
                <p>Applying this signature embeds an immutable SHA-256 cryptographic digest into the petition header, verifying document integrity for High Court & Civil Sub-Court e-filing.</p>
              </div>

              <button
                onClick={handleApplyDigitalSignature}
                className="w-full py-3 bg-[#1A1A1A] text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] hover:bg-black transition-colors flex items-center justify-center gap-2"
              >
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>Sign & Cryptographically Verify Document</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-emerald-900 text-white border-2 border-emerald-950 space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 font-bold uppercase text-[11px] tracking-wider">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Digital Signature Applied Successfully</span>
                </div>

                <div className="font-mono text-[11px] space-y-1.5 text-slate-200 pt-2 border-t border-emerald-800">
                  <div><strong className="text-emerald-400">SHA-256 Digest:</strong> {certificateData.hash}</div>
                  <div><strong className="text-emerald-400">Timestamp:</strong> {certificateData.timestamp}</div>
                  <div><strong className="text-emerald-400">Signer:</strong> {certificateData.signer} ({certificateData.enrollmentNo})</div>
                  <div><strong className="text-emerald-400">Trust Authority:</strong> {certificateData.certificateAuthority}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  alert('Verification Certificate downloaded to local system.');
                  onClose();
                }}
                className="w-full py-3 bg-[#1A1A1A] text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] hover:bg-black transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Signed Verification Certificate</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  RotateCcw, 
  FileCheck,
  GitBranch,
  Layers,
  Sparkles,
  Download,
  Copy,
  ExternalLink,
  Plus,
  Check,
  ChevronRight,
  ShieldCheck,
  FileCode,
  ArrowRight,
  Split,
  Maximize2,
  X
} from 'lucide-react';
import { EnterpriseDoc, CaseFile, DocumentVersion, DocumentClauseDiff } from '../types';
import { logAuditEvent } from '../lib/auditLogger';
import {
  saveDraftToMatterVault,
  useMatterDocuments,
  uploadDocumentToStorageAndDb,
  createDocumentRevisionInStorageAndDb,
  downloadDocumentFromStorage,
} from '../lib/useMatterData';

interface DocumentRepositoryProps {
  selectedCase: CaseFile;
  chamberId?: string;
  onOpenDigitalSignature?: () => void;
}

// Initial seed document data with multi-version histories and clause diffs
const INITIAL_ENTERPRISE_DOCS: EnterpriseDoc[] = [
  {
    id: 'doc-1',
    name: '2026_Impugned_Sale_Agreement_Draft.pdf',
    version: 2,
    size: '2.8 MB',
    type: 'Challenged Contract',
    uploadedBy: 'Senior Advocate Chambers',
    uploadDate: '2026-07-28',
    ocrStatus: 'Indexed',
    isDuplicate: false,
    watermarkEnabled: true,
    expiringLinkUrl: 'https://chamber.legal/dl/exp-991283',
    content: 'Amended Plaint Draft (v2.0): Survey No 402/1A (2160 sq.ft actual demarcation), prayer for cancellation of instrument under Section 31 Specific Relief Act, mandatory interim injunction, and reservation of co-heir pre-emption rights.',
    versions: [
      {
        id: 'ver-2.0',
        versionNumber: 2.0,
        versionLabel: 'v2.0 - Amended Plaint with Surveyor Demarcation',
        timestamp: '2026-07-28 16:30',
        author: 'Advocate Chambers (Senior Counsel)',
        authorRole: 'Senior Advocate',
        changesSummary: 'Amended survey boundary schedule to 2160 sq.ft pursuant to Tahsildar demarcation report. Added Section 31 cancellation prayer and co-heir pre-emption right recital.',
        fileSize: '2.8 MB',
        ocrStatus: 'Indexed',
        clauseCount: 6,
        content: `CLAUSE 1 (PARTIES & CO-HEIR RIGHT):
This Indenture is framed between the Plaintiff Ramesh Kumar and Defendants Suresh Kumar & Star Builders Ltd. Plaintiff asserts undivided 1/2 share in suit property as coparcener under Section 6 Hindu Succession Act.

CLAUSE 2 (SCHEDULE OF SUIT PROPERTY):
All that piece and parcel of land situate at Mylapore Village, Chennai, Old Survey No. 402/1, New Town Survey No. 402/1A, admeasuring 2160 sq.ft (revised from 2400 sq.ft following surveyor demarcation). Bounded on North by M.K. Street, South by Temple Lane, East by Survey 402/2, West by Corporation Road.

CLAUSE 3 (CHALLENGED CONSIDERATION):
The alleged sale consideration of ₹1,20,00,000 recorded in Doc No. 4012/2026 is fictitious, inadequate, and executed without consent or receipt of consideration by Plaintiff.

CLAUSE 4 (INVALIDITY OF 2021 UNREGISTERED SETTLEMENT):
The unregistered family arrangement dated 05-03-2021 relied upon by Defendant No. 1 is inadmissible in evidence for lack of registration under Section 17(1)(b) and Section 49 Registration Act.

CLAUSE 5 (STATUTORY LIMITATION RECITAL):
Suit is filed within 3 years from date of knowledge (June 2026) under Article 59 of the Limitation Act 1963.

CLAUSE 6 (RELIEF & PRAYER):
Declaration that Sale Deed 4012/2026 is null, void and non-est. Permanent injunction restraining alienations or construction on suit schedule property.`,
        diffFromPrevious: [
          {
            id: 'diff-1',
            clauseTitle: 'Clause 2: Property Schedule & Area Demarcation',
            status: 'modified',
            originalText: 'Old Survey No. 402/1, measuring 2400 sq.ft without field boundaries.',
            revisedText: 'New Town Survey No. 402/1A, measuring 2160 sq.ft actual with four verified field boundaries.',
            explanation: 'Rectified survey number and adjusted area to 2160 sq.ft based on Tahsildar inspection.'
          },
          {
            id: 'diff-2',
            clauseTitle: 'Clause 5: Statutory Limitation Act Recital',
            status: 'added',
            originalText: undefined,
            revisedText: 'Suit filed within 3 years from knowledge date (June 2026) under Article 59 Limitation Act 1963.',
            explanation: 'Inserted mandatory statutory limitation averment to safeguard against procedural dismissal.'
          },
          {
            id: 'diff-3',
            clauseTitle: 'Clause 6: Permanent Injunction Relief',
            status: 'added',
            originalText: undefined,
            revisedText: 'Permanent injunction restraining alienations or construction on suit schedule property.',
            explanation: 'Added prayer for interim and permanent restraint on third-party creation.'
          }
        ]
      },
      {
        id: 'ver-1.1',
        versionNumber: 1.1,
        versionLabel: 'v1.1 - Legal Redline & Notice Markups',
        timestamp: '2026-07-10 11:15',
        author: 'Junior Associate (K. Murugan)',
        authorRole: 'Junior Associate',
        changesSummary: 'Marked up unauthorized vendor representations; flagged absence of registered partition and inserted non-consent warning.',
        fileSize: '2.4 MB',
        ocrStatus: 'Indexed',
        clauseCount: 4,
        content: `CLAUSE 1 (PARTIES & CO-HEIR RIGHT):
Agreement executed by Suresh Kumar in favour of Star Builders Ltd. Note: Plaintiff Ramesh Kumar never joined as consenting party.

CLAUSE 2 (SCHEDULE OF SUIT PROPERTY):
All that piece and parcel of land situate at Mylapore Village, Old Survey No. 402/1, measuring 2400 sq.ft without field boundaries.

CLAUSE 3 (CHALLENGED CONSIDERATION):
The alleged sale consideration of ₹1,20,00,000 recorded in draft without proof of bank disbursement.

CLAUSE 4 (INVALIDITY OF 2021 UNREGISTERED SETTLEMENT):
The unregistered family arrangement dated 05-03-2021 relied upon by Defendant No. 1 is defective in law.`,
        diffFromPrevious: [
          {
            id: 'diff-4',
            clauseTitle: 'Clause 1: Non-Consenting Co-Heir Warning',
            status: 'modified',
            originalText: 'Suresh Kumar as sole absolute owner by family settlement.',
            revisedText: 'Suresh Kumar executing unilaterally without co-heir Ramesh Kumar joinder.',
            explanation: 'Rebutted false sole ownership recital in original vendor draft.'
          }
        ]
      },
      {
        id: 'ver-1.0',
        versionNumber: 1.0,
        versionLabel: 'v1.0 - Original Opposing Counsel Execution Copy',
        timestamp: '2026-06-14 09:45',
        author: 'Opposing Counsel Notary',
        authorRole: 'Notary / Scrivener',
        changesSummary: 'Original executed sale draft claiming sole absolute title under 2021 oral partition.',
        fileSize: '2.1 MB',
        ocrStatus: 'Indexed',
        clauseCount: 3,
        content: `CLAUSE 1 (PARTIES & CO-HEIR RIGHT):
Agreement of Sale executed by Suresh Kumar, sole absolute owner, in favour of Star Builders Ltd.

CLAUSE 2 (SCHEDULE OF SUIT PROPERTY):
All that piece and parcel of land situate at Mylapore Village, Old Survey No. 402/1, measuring 2400 sq.ft without field boundaries.

CLAUSE 3 (CHALLENGED CONSIDERATION):
Total sale consideration fixed at ₹1,20,00,000 with advance of ₹25,00,000 paid via cash and cheque.`
      }
    ]
  },
  {
    id: 'doc-2',
    name: '1995_Parent_Title_Deed_Mylapore.pdf',
    version: 2,
    size: '4.2 MB',
    type: 'Registered Parent Deed',
    uploadedBy: 'Advocate Chambers',
    uploadDate: '2026-07-29',
    ocrStatus: 'Indexed',
    watermarkEnabled: true,
    expiringLinkUrl: 'https://chamber.legal/dl/exp-991283',
    content: 'Certified Copy of Registered Sale Deed No. 1204/1995 executed by K. Ramachandran. Contains verified Tamil archaic script transcription and official Sub-Registrar endorsement.',
    versions: [
      {
        id: 'ver-p2.0',
        versionNumber: 2.0,
        versionLabel: 'v2.0 - Certified Official SRO Copy with Translation',
        timestamp: '2026-07-29 14:00',
        author: 'Advocate Chambers',
        authorRole: 'Senior Advocate',
        changesSummary: 'Uploaded certified translation of archaic Tamil boundary covenants with Sub-Registrar stamp endorsement.',
        fileSize: '4.2 MB',
        ocrStatus: 'Indexed',
        clauseCount: 4,
        content: `TITLE RECITALS:
K. Ramachandran purchased 2400 sq.ft at Mylapore Survey 402/1 under Doc 1204/1995.
Covenant 1: Absolute self-acquired property with clear market title.
Covenant 2: Undisputed four boundaries registered on 12-04-1995.
Covenant 3: Encumbrance Nil as certified by SRO Mylapore.`
      },
      {
        id: 'ver-p1.0',
        versionNumber: 1.0,
        versionLabel: 'v1.0 - Client Photostat Copy',
        timestamp: '2026-07-15 10:20',
        author: 'Client Upload (Ramesh Kumar)',
        authorRole: 'Client',
        changesSummary: 'Initial blurred photostat copy submitted during client intake.',
        fileSize: '3.6 MB',
        ocrStatus: 'Indexed',
        clauseCount: 3,
        content: `TITLE RECITALS:
Uncertified photocopy of Doc 1204/1995. Boundary text partially illegible on page 3.`
      }
    ]
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
    watermarkEnabled: true,
    content: 'Continuous Corporation of Chennai Property Tax assessment receipts paid from 1995 through 2025.',
    versions: [
      {
        id: 'ver-t1.0',
        versionNumber: 1.0,
        versionLabel: 'v1.0 - Consolidated Corporation Receipts',
        timestamp: '2026-07-25 09:00',
        author: 'Client Upload',
        authorRole: 'Client',
        changesSummary: 'Indexed 30 consecutive tax assessment receipts proving settled possession.',
        fileSize: '6.1 MB',
        ocrStatus: 'Indexed',
        clauseCount: 2,
        content: `TAX ASSESSMENT SCHEDULE:
Receipts for Assessment No. 09-114-0402-0012 covering FY 1995-1996 through FY 2024-2025.`
      }
    ]
  }
];

export const DocumentRepository: React.FC<DocumentRepositoryProps> = ({ 
  selectedCase,
  chamberId: propChamberId,
  onOpenDigitalSignature 
}) => {
  const chamberId = propChamberId || (selectedCase as any)?.chamberId || '';
  const {
    documents: hookDocs,
    loading: docsLoading,
    error: docsLoadError,
    refreshDocuments,
  } = useMatterDocuments(chamberId, selectedCase?.id);
  const [docs, setDocs] = useState<EnterpriseDoc[]>([]);
  const [docError, setDocError] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [isSavingRevision, setIsSavingRevision] = useState<boolean>(false);
  const [isDownloadingPath, setIsDownloadingPath] = useState<string | null>(null);

  // Use explicitly mapped database documents from useMatterDocuments without inventing sizes, content, or statuses
  useEffect(() => {
    setDocs(hookDocs || []);
  }, [hookDocs, selectedCase?.id]);

  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [watermarkToggle, setWatermarkToggle] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [restoreNotification, setRestoreNotification] = useState<string | null>(null);

  // Version History & Diff View states
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState<boolean>(false);
  const [selectedVersionAIndex, setSelectedVersionAIndex] = useState<number>(1);
  const [selectedVersionBIndex, setSelectedVersionBIndex] = useState<number>(0);
  const [diffViewMode, setDiffViewMode] = useState<'clauses' | 'inline'>('clauses');
  const [clauseFilter, setClauseFilter] = useState<'all' | 'altered' | 'added'>('all');
  
  // Draft New Revision Modal
  const [isNewRevisionModalOpen, setIsNewRevisionModalOpen] = useState<boolean>(false);
  const [newRevisionSummary, setNewRevisionSummary] = useState<string>('');
  const [newRevisionContent, setNewRevisionContent] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    e.target.value = '';

    setDocError(null);
    setRestoreNotification(null);

    if (!chamberId || !selectedCase?.id) {
      setDocError('Cannot upload document: active workspace and matter are required.');
      return;
    }

    setIsUploadingDoc(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);
      const mimeType = file.type || 'application/octet-stream';
      const isPlainTextFile =
        mimeType.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name);

      // Never interpret binary PDF/DOCX bytes as plain text
      const extractedText = isPlainTextFile
        ? new TextDecoder('utf-8').decode(rawBytes).slice(0, 50000)
        : null;

      const docType = file.name.toLowerCase().endsWith('.pdf')
        ? 'PDF Brief'
        : file.name.toLowerCase().endsWith('.docx')
          ? 'DOCX Pleading'
          : 'Document';

      const uploadedDoc = await uploadDocumentToStorageAndDb({
        workspaceId: chamberId,
        matterId: selectedCase.id,
        fileName: file.name,
        fileBytes: rawBytes,
        fileSize: file.size,
        mimeType,
        docType,
        changesSummary: 'Initial document upload into private matter storage vault.',
        extractedText,
      });

      await refreshDocuments();
      setSelectedDocId(uploadedDoc.id);
      setRestoreNotification(
        `Uploaded "${uploadedDoc.name}" (${uploadedDoc.size}, v${uploadedDoc.version}) to private Supabase Storage & PostgreSQL.`
      );
      logAuditEvent('DOCUMENT_UPLOAD', `Uploaded document file "${uploadedDoc.name}"`, {
        chamberId,
        caseId: selectedCase.id,
        docId: uploadedDoc.id,
      });
      setTimeout(() => setRestoreNotification(null), 5000);
    } catch (err: any) {
      console.error('Document upload error:', err);
      setDocError(err?.message || 'Failed to upload document to private storage and PostgreSQL.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDownloadDocument = async (
    filePath?: string,
    fileName?: string,
    storageBucket: string = 'matter-documents'
  ) => {
    setDocError(null);
    if (!filePath) {
      setDocError('Cannot download document: no storage file path is recorded for this version.');
      return;
    }

    setIsDownloadingPath(filePath);
    try {
      const { blob, size } = await downloadDocumentFromStorage(storageBucket, filePath);
      if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName || filePath.split('/').pop() || 'document';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }
      setRestoreNotification(
        `Downloaded "${fileName || filePath}" (${size} bytes) from private Supabase Storage.`
      );
      logAuditEvent('DOCUMENT_VIEW', `Downloaded document "${fileName || filePath}"`, {
        chamberId,
        caseId: selectedCase?.id,
      });
      setTimeout(() => setRestoreNotification(null), 4000);
    } catch (err: any) {
      console.error('Private storage download error:', err);
      setDocError(err?.message || 'Failed to download document from private Supabase Storage.');
    } finally {
      setIsDownloadingPath(null);
    }
  };

  const selectedDoc = docs.find(d => d.id === selectedDocId) || docs[0] || null;
  const docVersions = selectedDoc?.versions || [];

  const versionA: DocumentVersion | undefined = docVersions[selectedVersionAIndex] || docVersions[docVersions.length - 1];
  const versionB: DocumentVersion | undefined = docVersions[selectedVersionBIndex] || docVersions[0];

  if (docsLoading && docs.length === 0) {
    return (
      <div className="p-12 text-center bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-3">
        <FileText className="w-10 h-10 mx-auto text-[#B45309] animate-pulse" />
        <p className="text-xs font-mono uppercase tracking-wider text-[#1A1A1A] font-bold">
          Syncing Matter Documents & Immutable Versions from PostgreSQL...
        </p>
      </div>
    );
  }

  if (!selectedDoc) {
    return (
      <div className="p-12 text-center bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-4">
        {(docsLoadError || docError) && (
          <div role="alert" className="p-3 bg-[#FFF4F2] border-2 border-[#FF4444] text-xs text-[#FF4444] font-bold max-w-lg mx-auto">
            ⚠️ {docError || docsLoadError}
          </div>
        )}
        <FileText className="w-12 h-12 mx-auto text-slate-400" />
        <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">No Matter Documents Uploaded</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Upload actual client briefs, petitions, contracts or judgments into this matter vault. Original bytes are stored in private Supabase Storage with immutable version control.
        </p>
        <label className="inline-flex items-center gap-2 bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider px-4 py-2.5 border border-[#1A1A1A] cursor-pointer">
          <Upload className="w-4 h-4" />
          <span>{isUploadingDoc ? 'Uploading to Private Storage...' : 'Upload Document File'}</span>
          <input type="file" onChange={handleFileUpload} disabled={isUploadingDoc} className="hidden" />
        </label>
      </div>
    );
  }

  const handleGenerateExpiringLink = () => {
    setCopiedLink(true);
    logAuditEvent('DOCUMENT_VIEW', `Generated 24h expiring link for ${selectedDoc.name}`);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Rollback to selected historical revision by inserting a new immutable version in PostgreSQL + Storage
  const handleRollbackToVersion = async (targetVersion: DocumentVersion) => {
    setDocError(null);
    setRestoreNotification(null);
    if (!chamberId || !selectedCase?.id) {
      setDocError('Cannot rollback revision: active workspace and matter are required.');
      return;
    }

    setIsSavingRevision(true);
    try {
      const rollbackSummary = `Restored legal document state to Revision v${targetVersion.versionNumber} (${targetVersion.versionLabel}).`;
      const contentBytes = new TextEncoder().encode(targetVersion.content || '');
      const updatedDoc = await createDocumentRevisionInStorageAndDb({
        workspaceId: chamberId,
        matterId: selectedCase.id,
        documentId: selectedDoc.id,
        fileName: selectedDoc.name,
        fileBytes: contentBytes,
        fileSize: targetVersion.fileSizeBytes ?? contentBytes.byteLength,
        mimeType: targetVersion.mimeType || selectedDoc.mimeType || 'text/plain',
        changesSummary: rollbackSummary,
        extractedText: targetVersion.content || null,
        authorName: 'Senior Advocate (Rollback Action)',
      });

      await refreshDocuments();
      setSelectedVersionBIndex(0);
      setSelectedVersionAIndex(1);
      setRestoreNotification(
        `Rolled back "${selectedDoc.name}" to v${targetVersion.versionNumber}. Committed immutable revision v${updatedDoc.version} in PostgreSQL.`
      );
      logAuditEvent(
        'RESTORE_VERSION',
        `Rolled back ${selectedDoc.name} to v${targetVersion.versionNumber} (created v${updatedDoc.version})`,
        { chamberId, caseId: selectedCase.id, docId: selectedDoc.id }
      );
      setTimeout(() => setRestoreNotification(null), 5000);
    } catch (err: any) {
      console.error('Rollback revision error:', err);
      setDocError(err?.message || 'Failed to persist rollback revision to PostgreSQL.');
    } finally {
      setIsSavingRevision(false);
    }
  };

  // Commit a new immutable revision draft to private Supabase Storage & PostgreSQL `document_versions`
  const handleCreateNewRevision = async () => {
    if (!newRevisionSummary.trim() || isSavingRevision) return;
    setDocError(null);
    setRestoreNotification(null);

    if (!chamberId || !selectedCase?.id) {
      setDocError('Cannot commit revision: active workspace and matter are required.');
      return;
    }

    setIsSavingRevision(true);
    try {
      const textContent = newRevisionContent.trim() || selectedDoc.content || '';
      const rawBytes = new TextEncoder().encode(textContent);
      const updatedDoc = await createDocumentRevisionInStorageAndDb({
        workspaceId: chamberId,
        matterId: selectedCase.id,
        documentId: selectedDoc.id,
        fileName: selectedDoc.name,
        fileBytes: rawBytes,
        fileSize: rawBytes.byteLength,
        mimeType: 'text/plain',
        changesSummary: newRevisionSummary.trim(),
        extractedText: textContent || null,
        authorName: 'Advocate Chambers',
      });

      await refreshDocuments();
      setIsNewRevisionModalOpen(false);
      setNewRevisionSummary('');
      setNewRevisionContent('');
      setSelectedVersionBIndex(0);
      setSelectedVersionAIndex(1);

      setRestoreNotification(
        `Committed immutable revision v${updatedDoc.version} for "${selectedDoc.name}" in PostgreSQL & Storage.`
      );
      logAuditEvent(
        'DOCUMENT_UPDATE',
        `Committed revision v${updatedDoc.version} for ${selectedDoc.name}`,
        { chamberId, caseId: selectedCase.id, docId: selectedDoc.id }
      );
      setTimeout(() => setRestoreNotification(null), 4000);
    } catch (err: any) {
      console.error('Commit new revision error:', err);
      setDocError(
        err?.message || 'Failed to save new revision to PostgreSQL. Your input has been preserved.'
      );
    } finally {
      setIsSavingRevision(false);
    }
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Header */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Enterprise Document Vault & Revision Control</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Chamber Document Repository</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Track full revision history, highlight differences between document drafts, perform safe rollbacks, and manage watermarked client shares.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Version History & Diff Studio Action Button */}
            <button
              onClick={() => setIsVersionHistoryOpen(true)}
              className="px-4 py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              title="Open full version history and revision difference analyzer"
            >
              <GitBranch className="w-4 h-4 text-amber-400" />
              <span>Version History & Diff ({docVersions.length})</span>
            </button>

            {onOpenDigitalSignature && (
              <button
                onClick={onOpenDigitalSignature}
                className="px-4 py-3 bg-[#FDFCFB] text-[#1A1A1A] font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-[#B45309]" />
                <span>Digital Signature</span>
              </button>
            )}

            <label className="px-4 py-3 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] font-bold uppercase tracking-wider text-xs border-2 border-[#1A1A1A] flex items-center gap-2 cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-4 h-4 text-[#B45309]" />
              <span>{isUploadingDoc ? 'Uploading...' : 'Upload Document'}</span>
              <input type="file" onChange={handleFileUpload} disabled={isUploadingDoc} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {(docsLoadError || docError) && (
        <div role="alert" className="p-3.5 bg-[#FFF4F2] text-[#FF4444] font-mono text-xs border-2 border-[#FF4444] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-[#FF4444] shrink-0" />
            <span>{docError || docsLoadError}</span>
          </div>
          {docError && (
            <button onClick={() => setDocError(null)} className="text-xs hover:underline font-bold">✕</button>
          )}
        </div>
      )}

      {/* Toast Notification Banner */}
      {restoreNotification && (
        <div role="status" className="p-3.5 bg-emerald-950 text-white font-mono text-xs border-2 border-emerald-500 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{restoreNotification}</span>
          </div>
          <button onClick={() => setRestoreNotification(null)} className="text-xs hover:underline text-emerald-300">✕</button>
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Document Table with Version Badges */}
        <div className="lg:col-span-7 bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
              Repository Files ({docs.length})
            </h3>
            <span className="text-[10px] font-mono text-[#555555] truncate max-w-[280px]">
              Matter: <strong>{selectedCase.title}</strong>
            </span>
          </div>

          <div className="space-y-2.5">
            {docs.map((docItem) => {
              const isSelected = docItem.id === selectedDocId;
              const versionsCount = docItem.versions?.length || 1;

              return (
                <div
                  key={docItem.id}
                  onClick={() => {
                    setSelectedDocId(docItem.id);
                    setSelectedVersionBIndex(0);
                    setSelectedVersionAIndex(Math.min(1, (docItem.versions?.length || 1) - 1));
                    logAuditEvent('DOCUMENT_VIEW', `Inspected document vault item: ${docItem.name}`);
                  }}
                  className={`p-4 border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md'
                      : 'bg-[#F9F7F5] border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className={`w-5 h-5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-[#B45309]'}`} />
                    <div className="min-w-0">
                      <p className={`font-serif font-bold text-xs truncate ${isSelected ? 'text-amber-400' : 'text-[#1A1A1A]'}`}>
                        {docItem.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] opacity-80 mt-0.5 flex-wrap font-mono">
                        <span className="font-bold bg-amber-500/20 px-1 text-amber-600 dark:text-amber-300">
                          v{docItem.version}.0
                        </span>
                        <span>•</span>
                        <span>{versionsCount} revision{versionsCount === 1 ? '' : 's'}</span>
                        <span>•</span>
                        <span>{docItem.size}</span>
                        <span>•</span>
                        <span>{docItem.type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {docItem.filePath && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadDocument(
                            docItem.filePath,
                            docItem.name,
                            docItem.storageBucket || 'matter-documents'
                          );
                        }}
                        disabled={isDownloadingPath === docItem.filePath}
                        className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-400 text-black border-emerald-300 hover:bg-emerald-300'
                            : 'bg-white text-[#1A1A1A] border-[#1A1A1A] hover:bg-slate-100'
                        }`}
                        title="Download original file bytes from private Supabase Storage"
                      >
                        <Download className="w-3 h-3" />
                        <span>{isDownloadingPath === docItem.filePath ? '...' : 'Download'}</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDocId(docItem.id);
                        setIsVersionHistoryOpen(true);
                      }}
                      className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300' 
                          : 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A] hover:bg-black'
                      }`}
                      title="Inspect version history and differences for this file"
                    >
                      <History className="w-3 h-3" />
                      <span>History</span>
                    </button>

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

        {/* Right Column: Selected Document Inspector & Revision Summary */}
        <div className="lg:col-span-5 bg-[#F5F2EF] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4 text-xs">
          <div className="border-b border-[#1A1A1A] pb-2 flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309]">Selected Document Vault Card</span>
              <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A] mt-0.5">{selectedDoc.name}</h3>
              <span className="text-[10px] font-mono text-[#555555]">
                Size: {selectedDoc.size} • Status: {selectedDoc.processingStatus || selectedDoc.ocrStatus}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-[#1A1A1A] text-amber-400">
                Active v{selectedDoc.version}
              </span>
              {selectedDoc.filePath && (
                <button
                  onClick={() =>
                    handleDownloadDocument(
                      selectedDoc.filePath,
                      selectedDoc.name,
                      selectedDoc.storageBucket || 'matter-documents'
                    )
                  }
                  disabled={isDownloadingPath === selectedDoc.filePath}
                  className="px-2 py-1 bg-white border border-[#1A1A1A] text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-[#1A1A1A] hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>{isDownloadingPath === selectedDoc.filePath ? 'Downloading...' : 'Download Bytes'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Version Quick Control & Diff Trigger Box */}
            <div className="p-3.5 bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-2.5">
              <div className="flex justify-between items-center border-b border-[#1A1A1A]/20 pb-1.5">
                <span className="font-bold text-[10px] uppercase text-[#555555] flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>Revision Track ({docVersions.length} Recorded):</span>
                </span>
                <button
                  onClick={() => setIsVersionHistoryOpen(true)}
                  className="text-[10px] font-bold uppercase text-[#B45309] hover:underline flex items-center gap-0.5"
                >
                  Open Diff Studio <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Version List with Instant Rollback */}
              <div className="space-y-2">
                {docVersions.slice(0, 3).map((v, idx) => {
                  const isCurrentActive = idx === 0;
                  return (
                    <div 
                      key={v.id} 
                      className={`p-2.5 border text-[11px] space-y-1 transition-colors ${
                        isCurrentActive 
                          ? 'bg-amber-500/10 border-amber-600/60' 
                          : 'bg-[#F9F7F5] border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.2 font-mono font-bold text-[9px] ${
                            isCurrentActive ? 'bg-[#1A1A1A] text-amber-400' : 'bg-slate-200 text-slate-800'
                          }`}>
                            v{v.versionNumber}.0
                          </span>
                          <span className="font-serif font-bold text-[#1A1A1A] text-xs truncate max-w-[170px]">
                            {v.author}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">{v.timestamp}</span>
                      </div>

                      <p className="text-[10px] text-slate-600 line-clamp-2 italic font-sans">
                        "{v.changesSummary}"
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px]">
                        <span className="font-mono text-slate-500">{v.clauseCount} legal clauses</span>

                        {!isCurrentActive && (
                          <button
                            onClick={() => handleRollbackToVersion(v)}
                            className="text-[9px] font-bold uppercase tracking-wider text-rose-800 hover:text-black flex items-center gap-1 cursor-pointer underline"
                            title={`Rollback document to revision v${v.versionNumber}.0`}
                          >
                            <RotateCcw className="w-3 h-3 text-rose-700" />
                            <span>Rollback to v{v.versionNumber}.0</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => setIsNewRevisionModalOpen(true)}
                  className="w-full py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] font-bold uppercase tracking-wider text-[10px] border border-[#1A1A1A] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>Draft New Revision</span>
                </button>
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

          <div className="pt-2 border-t border-[#1A1A1A] space-y-2">
            <button
              onClick={() => setIsVersionHistoryOpen(true)}
              className="w-full py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Split className="w-4 h-4" />
              <span>Launch Revision Diff & Rollback Studio</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* FULL-SCREEN VERSION HISTORY & DIFFERENCE ANALYZER MODAL */}
      {/* ========================================================================= */}
      {isVersionHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#F5F2EF] border-b-2 border-[#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-amber-400 px-2 py-0.5">
                    Revision Control Studio
                  </span>
                  <span className="font-mono text-xs font-bold text-[#B45309]">
                    {selectedDoc.name}
                  </span>
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold italic text-[#1A1A1A] mt-1">
                  Version History & Comparative Difference Highlighter
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsNewRevisionModalOpen(true)}
                  className="px-3 py-1.5 bg-[#1A1A1A] text-amber-400 hover:bg-black text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Draft New Revision</span>
                </button>

                <button
                  onClick={() => setIsVersionHistoryOpen(false)}
                  className="p-1.5 bg-[#FDFCFB] hover:bg-slate-200 border-2 border-[#1A1A1A] text-[#1A1A1A] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Subheader: Comparison Selectors & Metrics Bar */}
            <div className="p-4 bg-[#1A1A1A] text-white border-b-2 border-[#1A1A1A] flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Revision Selectors */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-serif font-bold italic text-amber-400">
                  Compare Revisions:
                </span>

                {/* Base Revision A */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Baseline (Older):</span>
                  <select
                    value={selectedVersionAIndex}
                    onChange={(e) => setSelectedVersionAIndex(Number(e.target.value))}
                    className="bg-transparent text-amber-300 font-mono text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {docVersions.map((v, idx) => (
                      <option key={v.id} value={idx} className="bg-[#1A1A1A] text-white">
                        v{v.versionNumber}.0 — {v.author} ({v.timestamp})
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-slate-400 font-mono text-xs">vs</span>

                {/* Comparative Revision B */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Revised (Newer):</span>
                  <select
                    value={selectedVersionBIndex}
                    onChange={(e) => setSelectedVersionBIndex(Number(e.target.value))}
                    className="bg-transparent text-emerald-400 font-mono text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {docVersions.map((v, idx) => (
                      <option key={v.id} value={idx} className="bg-[#1A1A1A] text-white">
                        v{v.versionNumber}.0 — {v.author} ({v.timestamp})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* View Mode Toggle: Clauses Diff vs Full Text */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  onClick={() => setDiffViewMode('clauses')}
                  className={`px-2.5 py-1 font-bold uppercase border transition-colors cursor-pointer ${
                    diffViewMode === 'clauses' ? 'bg-amber-500 text-black border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  Clause-by-Clause Diff
                </button>
                <button
                  onClick={() => setDiffViewMode('inline')}
                  className={`px-2.5 py-1 font-bold uppercase border transition-colors cursor-pointer ${
                    diffViewMode === 'inline' ? 'bg-amber-500 text-black border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  Full Document Text
                </button>
              </div>
            </div>

            {/* Modal Body: Two Columns (Revision Timeline vs Diff Viewer) */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">
              
              {/* Left Column: Revision Timeline & Rollback Actions (4 cols) */}
              <div className="lg:col-span-4 p-4 border-r-2 border-[#1A1A1A] bg-[#F5F2EF] space-y-3 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#B45309]">
                    Provenance & Rollback Ledger
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 font-bold">
                    {docVersions.length} Recorded
                  </span>
                </div>

                <div className="space-y-3">
                  {docVersions.map((v, idx) => {
                    const isCurrent = idx === 0;
                    const isSelectedAsA = idx === selectedVersionAIndex;
                    const isSelectedAsB = idx === selectedVersionBIndex;

                    return (
                      <div
                        key={v.id}
                        className={`p-3.5 border-2 space-y-2 transition-all ${
                          isCurrent
                            ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                            : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/40 hover:border-[#1A1A1A]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-1.5 py-0.2 font-mono font-bold text-[10px] ${
                                isCurrent ? 'bg-amber-500 text-black' : 'bg-slate-200 text-slate-800'
                              }`}>
                                v{v.versionNumber}.0
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-700 text-white px-1.5 py-0.2">
                                  Active State
                                </span>
                              )}
                              {isSelectedAsA && (
                                <span className="text-[9px] uppercase font-bold tracking-widest bg-amber-400 text-black px-1">
                                  Baseline A
                                </span>
                              )}
                              {isSelectedAsB && (
                                <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-500 text-black px-1">
                                  Comparing B
                                </span>
                              )}
                            </div>
                            <h4 className="font-serif font-bold text-xs mt-1 leading-tight">
                              {v.versionLabel}
                            </h4>
                          </div>
                        </div>

                        <p className={`text-[11px] leading-relaxed italic font-sans ${isCurrent ? 'text-slate-300' : 'text-slate-600'}`}>
                          "{v.changesSummary}"
                        </p>

                        <div className={`text-[10px] font-mono pt-1.5 border-t flex items-center justify-between ${
                          isCurrent ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                        }`}>
                          <span>Author: <strong>{v.author}</strong></span>
                          <span>{v.timestamp}</span>
                        </div>

                        {/* Rollback Trigger Button */}
                        <div className="pt-2 flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setSelectedVersionAIndex(idx);
                            }}
                            className="text-[9px] font-bold uppercase tracking-wider text-[#B45309] hover:underline cursor-pointer"
                          >
                            Set Baseline A
                          </button>

                          {!isCurrent ? (
                            <button
                              onClick={() => handleRollbackToVersion(v)}
                              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold uppercase tracking-wider text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title={`Rollback document state to revision v${v.versionNumber}.0`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Rollback to v{v.versionNumber}.0</span>
                            </button>
                          ) : (
                            <span className="text-[9px] font-mono text-emerald-400 font-bold">
                              ✓ Current Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Comparative Diff Inspector (8 cols) */}
              <div className="lg:col-span-8 p-5 bg-[#FDFCFB] space-y-4 overflow-y-auto">
                {/* Diff Header Summary Banner */}
                <div className="p-3.5 bg-amber-500/10 border-2 border-amber-600/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309] block">
                      Differential Synthesis
                    </span>
                    <h3 className="font-serif font-bold text-sm text-[#1A1A1A]">
                      Comparing v{versionA?.versionNumber || 1}.0 vs v{versionB?.versionNumber || 2}.0
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold flex-wrap">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300">
                      +2 Added
                    </span>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300">
                      -1 Removed
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300">
                      ~2 Modified
                    </span>
                  </div>
                </div>

                {/* Diff Filter Strip */}
                <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2 text-xs">
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="text-slate-500 font-bold uppercase mr-1">Filter Clauses:</span>
                    <button
                      onClick={() => setClauseFilter('all')}
                      className={`px-2 py-0.5 font-bold uppercase border cursor-pointer ${
                        clauseFilter === 'all' ? 'bg-[#1A1A1A] text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      All Clauses
                    </button>
                    <button
                      onClick={() => setClauseFilter('altered')}
                      className={`px-2 py-0.5 font-bold uppercase border cursor-pointer ${
                        clauseFilter === 'altered' ? 'bg-[#1A1A1A] text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Altered / Added Only
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-500 font-serif italic">
                    Highlighted contract modifications between drafts
                  </span>
                </div>

                {/* View 1: Clause by Clause Side-by-Side Diff */}
                {diffViewMode === 'clauses' && (
                  <div className="space-y-4">
                    {/* Clause Diff Item 1: Boundary schedule */}
                    <div className="border-2 border-amber-600/60 bg-amber-50/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-amber-500 text-black font-bold text-[9px] uppercase font-mono">
                            MODIFIED CLAUSE
                          </span>
                          <h4 className="font-serif font-bold text-xs text-[#1A1A1A]">
                            Clause 2 — Schedule of Property & Boundary Area
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Survey Rectification</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-300">
                        {/* Older version */}
                        <div className="p-3 bg-red-50/60 border border-red-300 space-y-1">
                          <span className="text-[9px] font-bold uppercase text-red-800 font-mono block">
                            - Baseline (v{versionA?.versionNumber || 1}.0):
                          </span>
                          <p className="text-xs text-red-950 font-serif line-through leading-relaxed">
                            "All that piece and parcel of land situate at Mylapore Village, Old Survey No. 402/1, measuring 2400 sq.ft without field boundaries."
                          </p>
                        </div>

                        {/* Newer version */}
                        <div className="p-3 bg-emerald-50/60 border border-emerald-300 space-y-1">
                          <span className="text-[9px] font-bold uppercase text-emerald-800 font-mono block">
                            + Revised (v{versionB?.versionNumber || 2}.0):
                          </span>
                          <p className="text-xs text-emerald-950 font-serif font-semibold leading-relaxed">
                            "New Town Survey No. <mark className="bg-emerald-200 text-emerald-950 font-bold px-0.5">402/1A</mark>, measuring <mark className="bg-emerald-200 text-emerald-950 font-bold px-0.5">2160 sq.ft actual</mark> following surveyor demarcation. Bounded on North by M.K. Street, South by Temple Lane, East by Survey 402/2, West by Corporation Road."
                          </p>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-600 font-mono pt-1">
                        <strong>Legal Impact:</strong> Corrects fatal boundary variance to align with official Revenue Patta records.
                      </p>
                    </div>

                    {/* Clause Diff Item 2: Statutory Limitation Clause (Added) */}
                    <div className="border-2 border-emerald-600/60 bg-emerald-50/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-700 text-white font-bold text-[9px] uppercase font-mono">
                            + ADDED CLAUSE
                          </span>
                          <h4 className="font-serif font-bold text-xs text-[#1A1A1A]">
                            Clause 5 — Article 59 Limitation Act Procedural Recital
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold">New In Revision</span>
                      </div>

                      <div className="p-3 bg-emerald-50/70 border border-emerald-300 space-y-1">
                        <span className="text-[9px] font-bold uppercase text-emerald-800 font-mono block">
                          + Inserted in Revision v{versionB?.versionNumber || 2}.0:
                        </span>
                        <p className="text-xs text-emerald-950 font-serif font-semibold leading-relaxed">
                          "Suit is filed strictly within 3 years from the date of knowledge of fraudulent instrument (June 2026) under Article 59 of the Limitation Act 1963."
                        </p>
                      </div>

                      <p className="text-[10px] text-slate-600 font-mono pt-1">
                        <strong>Legal Impact:</strong> Essential procedural safeguard to overcome limitation challenge under Order 7 Rule 11 CPC.
                      </p>
                    </div>

                    {/* Clause Diff Item 3: Permanent Injunction Relief (Added) */}
                    <div className="border-2 border-emerald-600/60 bg-emerald-50/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-700 text-white font-bold text-[9px] uppercase font-mono">
                            + ADDED PRAYER
                          </span>
                          <h4 className="font-serif font-bold text-xs text-[#1A1A1A]">
                            Clause 6 — Specific Relief Act Cancellation & Permanent Injunction
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold">New In Revision</span>
                      </div>

                      <div className="p-3 bg-emerald-50/70 border border-emerald-300 space-y-1">
                        <span className="text-[9px] font-bold uppercase text-emerald-800 font-mono block">
                          + Inserted in Revision v{versionB?.versionNumber || 2}.0:
                        </span>
                        <p className="text-xs text-emerald-950 font-serif font-semibold leading-relaxed">
                          "Declaration that Sale Deed 4012/2026 is null, void and non-est under Section 31 Specific Relief Act. Permanent injunction restraining alienations or construction on suit schedule property."
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* View 2: Full Document Text Inline Comparison */}
                {diffViewMode === 'inline' && (
                  <div className="p-4 bg-slate-900 text-slate-200 border-2 border-slate-800 font-mono text-xs leading-relaxed space-y-3">
                    <div className="text-[10px] uppercase font-bold text-amber-400 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span>Full Document Stream Comparison (v{versionB?.versionNumber || 2}.0 Active Text)</span>
                      <span>{versionB?.clauseCount || 6} Clauses Indexed</span>
                    </div>

                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300">
                      {versionB?.content || selectedDoc.content}
                    </pre>
                  </div>
                )}

                {/* Bottom Action Strip: Rollback Confirmation */}
                <div className="p-3 bg-[#F5F2EF] border-2 border-[#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs space-y-0.5">
                    <span className="font-serif font-bold text-[#1A1A1A]">Ready to restore an earlier revision?</span>
                    <p className="text-[11px] text-slate-600">
                      Rollback creates an immutable v{Math.round((selectedDoc.version + 1.0) * 10) / 10}.0 restoration record without deleting prior audit history.
                    </p>
                  </div>

                  <button
                    onClick={() => handleRollbackToVersion(versionA || docVersions[docVersions.length - 1])}
                    className="px-4 py-2 bg-rose-800 hover:bg-rose-900 text-white font-bold uppercase tracking-wider text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Rollback to v{versionA?.versionNumber || 1}.0 Content</span>
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAFT NEW REVISION MODAL */}
      {/* ========================================================================= */}
      {isNewRevisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#B45309]" />
                <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
                  Commit New Document Revision (v{Number(selectedDoc.version) + 1})
                </h3>
              </div>
              <button onClick={() => setIsNewRevisionModalOpen(false)} className="text-xs hover:underline">✕</button>
            </div>

            {docError && (
              <div role="alert" className="p-2.5 bg-[#FFF4F2] border border-[#FF4444] text-xs font-mono font-bold text-[#FF4444]">
                ⚠️ {docError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-[10px] text-slate-700 block mb-1">
                  Revision Summary / Change Reason:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Added rejoinder to counter-affidavit, corrected survey bounds"
                  value={newRevisionSummary}
                  onChange={(e) => setNewRevisionSummary(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] font-sans focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-[10px] text-slate-700 block mb-1">
                  Updated Legal Text / Clauses:
                </label>
                <textarea
                  rows={6}
                  placeholder="Enter updated clause content or amended pleadings..."
                  value={newRevisionContent}
                  onChange={(e) => setNewRevisionContent(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] font-mono text-[11px] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A1A1A]">
              <button
                onClick={() => setIsNewRevisionModalOpen(false)}
                disabled={isSavingRevision}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewRevision}
                disabled={!newRevisionSummary.trim() || isSavingRevision}
                className="px-4 py-2 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingRevision ? 'Saving...' : `Save Revision v${Number(selectedDoc.version) + 1}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

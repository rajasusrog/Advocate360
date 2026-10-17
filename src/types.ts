export type AgentRole = 
  | 'legal_research'
  | 'drafting'
  | 'document_intelligence'
  | 'evidence_analysis'
  | 'court_hearing'
  | 'case_strategy'
  | 'client_communication'
  | 'compliance_procedure';

export interface AgentInfo {
  id: AgentRole;
  name: string;
  iconName: string;
  title: string;
  description: string;
  badgeColor: string;
}

export interface CaseAssessment {
  favourableFactors?: string[];
  riskFactors?: string[];
  evidenceGaps?: string[];
  contradictions?: string[];
  proceduralRisks?: string[];
  limitationIssues?: string[];
  supportingAuthorities?: string[];
  opposingAuthorities?: string[];
  overallAssessment?: 'Strong Supporting Material' | 'Moderate Supporting Material' | 'Mixed / Requires Review' | 'Material Risks Identified' | 'Insufficient Information' | 'Not assessed';
  notes?: string;
  disclaimer?: string;
}

export interface SourceLedgerItem {
  id: string;
  sourceType: 'Client Statement' | 'Uploaded Document' | 'Public Land Record' | 'AI Inference' | 'Advocate Verified';
  sourceTitle: string;
  verifiedBy?: string;
  timestamp: string;
  note?: string;
}

export interface AuditLog {
  id: string;
  chamberId: string;
  actorUid: string;
  actorEmail: string;
  action: 'CASE_CREATE' | 'CASE_UPDATE' | 'DOCUMENT_UPLOAD' | 'DOCUMENT_UPDATE' | 'DOCUMENT_VIEW' | 'DOCUMENT_DELETE' | 'ROLE_CHANGE' | 'AI_GENERATION' | 'DRAFT_CREATE' | 'RESTORE_VERSION' | 'EXPORT_PDF' | 'PREPARATION_SIGN' | 'BACKUP_CREATE' | 'CONFLICT_SEARCH' | 'DOCUMENT_CREATE';
  details: string;
  timestamp: string;
}

export interface MatterMemory {
  clientPreferences?: string;
  advocateStyle?: string;
  precedentRules?: string[];
  keyArguments?: string[];
  evidenceNotes?: string[];
}

export type WorkflowStepId = 
  | 'intake'
  | 'create_matter'
  | 'request_docs'
  | 'analyze_docs'
  | 'extract_timeline'
  | 'risk_report'
  | 'assign_junior'
  | 'schedule_hearing'
  | 'prepare_draft'
  | 'senior_review'
  | 'court_filing'
  | 'archive';

export interface WorkflowStageItem {
  id: WorkflowStepId;
  label: string;
  status: 'completed' | 'in_progress' | 'pending' | 'action_required';
  assignedTo?: string;
  autoExecuted?: boolean;
  timestamp?: string;
  notes?: string;
}

export interface CaseFile {
  id: string;
  userId?: string;
  chamberId?: string;
  title: string;
  caseNumber?: string;
  caseType: 'Property Dispute' | 'Contract & Recovery' | 'Criminal / FIR' | 'Family & Matrimonial' | 'Corporate & Civil' | 'Other';
  status: 'Intake' | 'Analysis' | 'Research' | 'Drafting' | 'Pending Hearing' | 'Closed' | 'Archived';
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  oppositeParty?: string;
  courtName?: string;
  judgeName?: string;
  nextHearingDate?: string;
  stage?: string;
  summary?: string;
  timeline?: string[];
  caseAssessment?: CaseAssessment;
  memory?: MatterMemory;
  workflowStages?: WorkflowStageItem[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archivedReason?: string;
  previousStatus?: string;
  lastActivityDate?: string;
}

export interface ArchivePolicySettings {
  enabled: boolean;
  inactivityDays: number;
  autoArchiveClosed: boolean;
  lastSweepRun?: string;
}

export interface IntakeData {
  rawStory: string;
  caseType: string;
  parties: {
    client: string;
    oppositeParty: string;
    keyWitnesses: string[];
  };
  timeline: { date: string; event: string }[];
  importantDates: { label: string; date: string }[];
  missingInformation: string[];
  requiredDocuments: string[];
  suggestedAction: string;
}

export interface DocumentAnalysisResult {
  fileName: string;
  docType: string;
  keyFacts: string[];
  timelineEvents: { date: string; description: string; sourceDoc: string }[];
  contradictions: {
    item1: string;
    item2: string;
    source1: string;
    source2: string;
    severity: 'High' | 'Medium' | 'Low';
    explanation: string;
  }[];
  missingEvidence: string[];
  importantClauses: string[];
  suggestedLegalIssues: string[];
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  title: string;
  type: 'Document' | 'Photo' | 'Audio' | 'Video' | 'WhatsApp Chat' | 'Bank Statement';
  submittedBy: string;
  provesWhat: string;
  cannotProve: string;
  date: string;
  status: 'Verified' | 'Unverified' | 'Contradictory' | 'Challenged';
}

export interface EvidenceScorecard {
  overallScore: number;
  checks: {
    title: string;
    status: 'pass' | 'fail' | 'warning';
    note: string;
  }[];
  missingCriticalEvidence: string[];
}

export interface TimelineNode {
  id: string;
  date: string;
  event: string;
  sourceDoc?: string;
  category: 'Property' | 'Notice' | 'Transaction' | 'Court Filing' | 'Communication';
  flag?: string;
}

export interface ContradictionItem {
  id: string;
  statementA: { text: string; source: string; date?: string };
  statementB: { text: string; source: string; date?: string };
  natureOfContradiction: string;
  impactOnCase: 'Severe' | 'Moderate' | 'Minor';
  recommendedVerification: string;
}

export type ChamberRole = 
  | 'CHAMBER_OWNER' 
  | 'SENIOR_ADVOCATE'
  | 'ADVOCATE' 
  | 'JUNIOR_ADVOCATE' 
  | 'ASSOCIATE'
  | 'PARALEGAL' 
  | 'CLERK' 
  | 'RECEPTIONIST'
  | 'CLIENT' 
  | 'EXTERNAL_COUNSEL'
  | 'ADMINISTRATOR'
  | 'READ_ONLY';

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'client' | 'case' | 'document' | 'evidence' | 'witness' | 'hearing' | 'precedent' | 'risk';
  status?: string;
  details?: string;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export interface AgentOrchestrationTask {
  agentId: AgentRole;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'alert';
  lastRun: string;
  summary: string;
  outputsCount: number;
}

export interface NotificationItem {
  id: string;
  category: 'hearing' | 'ai_alert' | 'client_msg' | 'deadline' | 'fee' | 'compliance';
  title: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  linkTab?: string;
  severity?: 'high' | 'medium' | 'info';
}

export interface DocumentClauseDiff {
  id: string;
  clauseTitle: string;
  status: 'added' | 'removed' | 'modified' | 'unmodified';
  originalText?: string;
  revisedText?: string;
  explanation: string;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  versionLabel: string;
  timestamp: string;
  author: string;
  authorRole?: string;
  changesSummary: string;
  fileSize: string;
  fileSizeBytes?: number;
  filePath?: string;
  mimeType?: string;
  ocrStatus: 'Indexed' | 'Processing' | 'Failed' | 'Uploaded' | 'Processed' | string;
  clauseCount: number;
  content: string;
  diffFromPrevious?: DocumentClauseDiff[];
}

export interface EnterpriseDoc {
  id: string;
  workspaceId?: string;
  matterId?: string;
  name: string;
  version: number;
  size: string;
  fileSizeBytes?: number;
  mimeType?: string;
  filePath?: string;
  storageBucket?: string;
  type: string;
  uploadedBy: string;
  uploadDate: string;
  ocrStatus: 'Indexed' | 'Processing' | 'Failed' | 'Uploaded' | 'Processed' | string;
  processingStatus?: string;
  reviewStatus?: string;
  isDuplicate?: boolean;
  watermarkEnabled?: boolean;
  expiringLinkUrl?: string;
  content?: string;
  versions?: DocumentVersion[];
}

export interface ConflictCheckResult {
  queryName: string;
  isConflictFound: boolean;
  matchedCase?: string;
  matchedParty?: string;
  conflictLevel: 'Direct Conflict' | 'Potential Conflict' | 'Clear';
  details: string;
  timestamp: string;
}

export interface ChamberProfile {
  id: string;
  name: string;
  ownerUid: string;
  advocateName: string;
  enrollmentNo?: string;
  stateBarCouncil?: string;
  officeLocation?: string;
  phone?: string;
  email?: string;
  practiceAreas?: string[];
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  chamberId: string;
  role: ChamberRole;
  createdAt: string;
}

export interface LandmarkJudgment {
  citation: string;
  court: string;
  year: string;
  ratio: string;
  verificationStatus?: 'VERIFIED SOURCE' | 'UNVERIFIED — VERIFY BEFORE RELIANCE';
  sourceUrl?: string;
}

export interface LegalResearchResult {
  query: string;
  relevantProvisions: { act: string; section: string; explanation: string }[];
  legalPrinciples: string[];
  landmarkJudgments: LandmarkJudgment[];
  supportingArguments: string[];
  opposingArguments: string[];
  practicalConsiderations: string[];
}

export interface JudgmentSummary {
  caseName: string;
  citation: string;
  bench: string;
  facts: string;
  keyLegalIssues: string[];
  courtReasoning: string;
  ratioDecidendi: string;
  finalOrder: string;
  practicalTakeaways: string[];
}

export interface DraftDocument {
  id: string;
  title: string;
  type: 'Legal Notice' | 'Plaint / Petition' | 'Affidavit' | 'Written Statement' | 'Bail Application' | 'Injunction Application';
  facts: string;
  legalGrounds: string[];
  prayer: string;
  contentMarkdown: string;
  createdAt: string;
}

export interface CrossExamQuestion {
  id: string;
  category: string;
  question: string;
  objective: string;
  targetContradictionOrDoc?: string;
}

export interface LimitationCheckResult {
  causeOfActionDate: string;
  filingDate: string;
  caseType: string;
  statutoryLimit: string;
  isWithinLimitation: boolean | null;
  status: 'Safe' | 'Borderline / Approaching' | 'Barred by Limitation' | 'Requires Condonation of Delay';
  keyVerifications: string[];
  notes: string;
}

export interface HearingBrief {
  caseTitle: string;
  caseNumber: string;
  court: string;
  nextHearingDate: string;
  purposeOfHearing: string;
  factsSummary: string[];
  keyDates: { date: string; event: string }[];
  reliefSought: string;
  opponentLikelyArguments: string[];
  keyDocumentsToKeepReady: string[];
  questionsForClient: string[];
  hearingChecklist: { item: string; checked: boolean }[];
}

export interface PracticeTask {
  id: string;
  caseId?: string;
  title: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  category: 'Hearing' | 'Drafting' | 'Client Follow-up' | 'Evidence Collection' | 'Fee Reminder';
  assignedTo?: string;
  dependsOn?: string[]; // IDs of tasks that must be completed before this task can start
  historicalDurationDays?: number; // Benchmarked completion time in days
  suggestedBufferDays?: number; // AI suggested buffer days
  bufferAlertReason?: string; // AI buffer reason
}

export interface DeadlineAlert {
  id: string;
  taskId: string;
  taskTitle: string;
  relatedHearingId?: string;
  relatedHearingTitle?: string;
  relatedHearingDate?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'ADVISORY';
  suggestedBufferDays: number;
  currentDeadline: string;
  recommendedDeadline: string;
  historicalDuration?: string;
  reasoning: string;
  suggestedAction: string;
}

export interface CalendarEvent {
  id: string;
  caseId: string;
  caseTitle: string;
  court: string;
  hearingType: string;
  date: string;
  time: string;
  judge?: string;
  status: 'Scheduled' | 'Adjourned' | 'Completed';
}

export interface FeeRecord {
  id: string;
  caseId: string;
  clientName: string;
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: 'Paid' | 'Partially Paid' | 'Overdue' | 'Upcoming';
}

export interface TimeLog {
  id: string;
  caseId: string;
  caseTitle: string;
  advocateName: string;
  advocateRole?: string;
  taskCategory: 'Legal Research' | 'Court Hearing' | 'Drafting Petition' | 'Client Consultation' | 'Document Review' | 'Evidence Analysis' | 'Filing & Administrative';
  description: string;
  hours: number;
  hourlyRate: number;
  totalAmount: number;
  date: string;
  billable: boolean;
  status: 'Unbilled' | 'Invoiced' | 'Waived';
  invoiceId?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
  timeLogId?: string;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'UPI' | 'Bank Transfer' | 'Cheque' | 'Cash' | 'Card';
  referenceNo?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  caseId: string;
  caseTitle: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  issueDate: string;
  dueDate: string;
  hourlyRate: number;
  items: InvoiceItem[];
  subtotal: number;
  taxRatePercentage: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'Draft' | 'Issued' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Cancelled';
  paymentTerms?: string;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId: string;
  };
  notes?: string;
  payments?: InvoicePayment[];
  createdAt: string;
  updatedAt: string;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  priority: 'High' | 'Normal' | 'Urgent';
  tag: 'Strategy' | 'Client Call' | 'Limitation' | 'Court Memo' | 'Urgent Thought' | 'Evidence Note';
  hasAudioTranscription?: boolean;
  assignedCaseId?: string;
  assignedCaseTitle?: string;
}

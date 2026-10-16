import { 
  CaseFile, 
  IntakeData, 
  DocumentAnalysisResult, 
  EvidenceItem, 
  EvidenceScorecard, 
  TimelineNode, 
  ContradictionItem, 
  CalendarEvent, 
  PracticeTask,
  FeeRecord
} from '../types';

export const INITIAL_CASES: CaseFile[] = [
  {
    id: 'case-101',
    title: 'Ramesh Kumar vs. Suresh Kumar & Ors.',
    caseNumber: 'O.S. 402/2024',
    caseType: 'Property Dispute',
    status: 'Analysis',
    clientName: 'Ramesh Kumar',
    clientPhone: '+91 98765 43210',
    clientEmail: 'ramesh.kumar@example.com',
    oppositeParty: 'Suresh Kumar (Brother)',
    courtName: 'City Civil Court, Chennai',
    judgeName: 'Hon. Justice M. Swaminathan',
    nextHearingDate: '2026-08-05',
    stage: 'Frame Issues & Injunction Hearing',
    summary: 'Dispute regarding unlawful sale of undivided ancestral property in Mylapore without consent of legal heir.',
    caseAssessment: {
      overallAssessment: 'Moderate Supporting Material',
      favourableFactors: ['1995 Parent Title Deed verified', 'Property tax receipts present'],
      riskFactors: ['Possession challenge by builder'],
      disclaimer: 'AI-assisted assessment — advocate review required.'
    },
    createdAt: '2026-07-15',
    updatedAt: '2026-07-28'
  },
  {
    id: 'case-102',
    title: 'M/S Apex Tech Ltd. vs. Vertex Infra Pvt Ltd.',
    caseNumber: 'Com. Suit 118/2025',
    caseType: 'Contract & Recovery',
    status: 'Drafting',
    clientName: 'M/S Apex Tech Ltd (Director Rajesh)',
    clientPhone: '+91 91234 56789',
    clientEmail: 'rajesh@apextech.in',
    oppositeParty: 'Vertex Infra Pvt Ltd',
    courtName: 'High Court Commercial Division',
    judgeName: 'Hon. Justice K. Rangarajan',
    nextHearingDate: '2026-08-12',
    stage: 'Written Statement & Recovery Notice',
    summary: 'Recovery of outstanding ₹45,00,000 for software development services rendered under 2024 Master Service Agreement.',
    caseAssessment: {
      overallAssessment: 'Strong Supporting Material',
      favourableFactors: ['Signed Master Service Agreement', 'Invoices and delivery sign-offs'],
      disclaimer: 'AI-assisted assessment — advocate review required.'
    },
    createdAt: '2026-06-20',
    updatedAt: '2026-07-25'
  },
  {
    id: 'case-103',
    title: 'State vs. Vikram Anand (Bail Appln)',
    caseNumber: 'Crl. M.P. 5102/2026',
    caseType: 'Criminal / FIR',
    status: 'Pending Hearing',
    clientName: 'Priya Anand (Wife)',
    clientPhone: '+91 99887 76655',
    clientEmail: 'priya.a@example.com',
    oppositeParty: 'State Inspector of Police',
    courtName: 'Principal Sessions Court',
    judgeName: 'Hon. Sessions Judge S. Bhaskar',
    nextHearingDate: '2026-07-30',
    stage: 'Anticipatory Bail Arguments',
    summary: 'Allegations under Sec 420/406 IPC regarding financial discrepancy in partnership firm. Contradictory statements in FIR.',
    caseAssessment: {
      overallAssessment: 'Mixed / Requires Review',
      favourableFactors: ['FIR delay of 8 months', 'Civil nature of accounting dispute'],
      riskFactors: ['Bank statement reconciliation pending'],
      disclaimer: 'AI-assisted assessment — advocate review required.'
    },
    createdAt: '2026-07-22',
    updatedAt: '2026-07-29'
  }
];

export const SAMPLE_INTAKE: IntakeData = {
  rawStory: "My late father left a 2400 sq.ft plot in Mylapore, Chennai. After his demise in 2020, my elder brother Suresh Kumar got an unregistered partition deed drafted in 2021 and claimed he owns the front half. Last month, without informing me, he executed a Sale Deed transferring the whole property to a builder for ₹1.2 Crores. I have tax receipts paid by me from 2020 to 2025 and father's original 1995 Sale Deed.",
  caseType: 'Property Dispute',
  parties: {
    client: 'Ramesh Kumar (Son / Legal Heir)',
    oppositeParty: 'Suresh Kumar (Brother) & Star Builders Ltd.',
    keyWitnesses: ['K. Sundaram (Neighbor / Family Friend)', 'R. Venkat (Notary)']
  },
  timeline: [
    { date: '1995-04-12', event: 'Father purchased Mylapore plot via registered Sale Deed Doc No. 1204/1995.' },
    { date: '2020-09-18', event: 'Father passed away intestate leaving Ramesh and Suresh as joint legal heirs.' },
    { date: '2021-03-05', event: 'Unregistered Partition Deed drawn up by Suresh (Not registered under Registration Act).' },
    { date: '2026-06-14', event: 'Suresh executed Sale Deed Doc No. 4012/2026 transferring entire 2400 sq.ft to Star Builders.' }
  ],
  importantDates: [
    { label: 'Father Demise', date: '2020-09-18' },
    { label: 'Unregistered Partition', date: '2021-03-05' },
    { label: 'Impugned Sale Deed', date: '2026-06-14' },
    { label: 'Limitation End Date (3 yrs from sale notice)', date: '2029-06-14' }
  ],
  missingInformation: [
    'Whether Ramesh received any partial consideration from the 2021 partition.',
    'Whether Ramesh ever signed as a witness on any sale agreement with Star Builders.',
    'Legal Heirship Certificate copy from Revenue Dept.'
  ],
  requiredDocuments: [
    'Original Sale Deed 1204/1995',
    'Certified Copy of Sale Deed 4012/2026 (Suresh to Builder)',
    'Unregistered Partition Deed 2021',
    'Legal Heir Certificate of Late Father',
    'Property Tax Payment Receipts (2020-2025 paid by Ramesh)'
  ],
  suggestedAction: 'File an Urgent Suit for Declaration of Sale Deed as Null & Void, Partition of 1/2 share, and Interim Injunction against construction/third-party creation.'
};

export const SAMPLE_DOC_ANALYSIS: DocumentAnalysisResult = {
  fileName: 'Mylapore_Property_Docs_Bundle.pdf (84 Pages)',
  docType: 'Bundle of Title & Partition Documents',
  keyFacts: [
    'Original Title Deed dated 12-04-1995 stands in the sole name of Late K. Ramachandran.',
    'No registered will was found in Sub-Registrar Office records.',
    'Unregistered Partition Agreement dated 05-03-2021 lacks proper stamp duty (stamped ₹100 instead of 1% ad valorem).',
    'Sale Deed Doc No. 4012/2026 claims Suresh Kumar is sole owner by virtue of oral partition.',
    'Ramesh Kumar continuously paid Municipal Property Tax under joint folio up to Q2 2026.'
  ],
  timelineEvents: [
    { date: '1995-04-12', description: 'Property registered in father K. Ramachandran name', sourceDoc: 'Sale Deed 1204/1995' },
    { date: '2020-09-18', description: 'Death of K. Ramachandran (Intestate)', sourceDoc: 'Death Certificate' },
    { date: '2021-03-05', description: 'Unregistered partition document drafted', sourceDoc: 'Partition Agreement' },
    { date: '2026-06-14', description: 'Sale Deed executed to Star Builders for ₹1.20 Cr', sourceDoc: 'Sale Deed 4012/2026' }
  ],
  contradictions: [
    {
      item1: 'Sale Deed 4012/2026 states Suresh Kumar obtained sole ownership via oral partition in August 2020.',
      item2: 'Unregistered Partition Deed dated March 2021 shows partition was attempted in 2021, not August 2020.',
      source1: 'Sale Deed Doc 4012/2026 Page 3',
      source2: 'Unregistered Partition Agreement Page 1',
      severity: 'High',
      explanation: 'Suresh claims two mutually exclusive dates of partition (Aug 2020 oral vs Mar 2021 written).'
    },
    {
      item1: 'Builder Affidavit claims vacant physical possession was delivered by Suresh on 15 June 2026.',
      item2: 'Electricity bills & tenant rental receipts show Ramesh Kumar tenant occupies ground floor till date.',
      source1: 'Builder Possession Affidavit',
      source2: 'EB Card & Tenant Rent Receipts June 2026',
      severity: 'High',
      explanation: 'Constructive physical possession was never transferred because Ramesh tenant resides there.'
    }
  ],
  missingEvidence: [
    'Revenue Survey Settlement Sketch (FMB Copy)',
    'Patta Transfer Order (if any mutated by Suresh secretly)',
    'Bank Account Statement of Suresh showing receipt of ₹1.2 Cr'
  ],
  importantClauses: [
    'Clause 4 of Sale Deed 4012/2026: "Vendor indemnifies Purchaser against all claims by legal heirs."',
    'Clause 9 of Partition Agreement: "This document shall be registered within 30 days" (Never complied).'
  ],
  suggestedLegalIssues: [
    'Whether an unregistered partition deed creating division of immovable property > ₹100 is admissible in evidence under Sec 49 Registration Act?',
    'Whether one co-owner/tenant-in-common can convey full title to a third party without joining other co-heirs?',
    'Whether the purchaser is a bona fide purchaser for value without notice when property tax & possession reflect co-heir presence?'
  ]
};

export const SAMPLE_EVIDENCE: EvidenceItem[] = [
  {
    id: 'ev-1',
    caseId: 'case-101',
    title: 'Original Title Deed Doc 1204/1995',
    type: 'Document',
    submittedBy: 'Client (Ramesh)',
    provesWhat: 'Proves father K. Ramachandran had clean absolute title.',
    cannotProve: 'Does not prove who is in actual possession today.',
    date: '1995-04-12',
    status: 'Verified'
  },
  {
    id: 'ev-2',
    caseId: 'case-101',
    title: 'Municipal Property Tax Receipts (2020-2026)',
    type: 'Document',
    submittedBy: 'Client (Ramesh)',
    provesWhat: 'Proves Ramesh paid taxes continuously and claimed interest.',
    cannotProve: 'Does not prove title ownership by itself.',
    date: '2026-05-10',
    status: 'Verified'
  },
  {
    id: 'ev-3',
    caseId: 'case-101',
    title: 'WhatsApp Chat Export with Suresh',
    type: 'WhatsApp Chat',
    submittedBy: 'Client (Ramesh)',
    provesWhat: 'Suresh admitted in May 2026 that Ramesh holds 50% undivided right.',
    cannotProve: 'Lacks Sec 65B Evidence Act Certificate currently.',
    date: '2026-05-22',
    status: 'Unverified'
  },
  {
    id: 'ev-4',
    caseId: 'case-101',
    title: 'Site Photos & EB Meter Bills',
    type: 'Photo',
    submittedBy: 'Client (Ramesh)',
    provesWhat: 'Proves Ramesh installed tenant on ground floor.',
    cannotProve: 'Does not prove boundary division.',
    date: '2026-07-01',
    status: 'Verified'
  }
];

export const SAMPLE_EVIDENCE_SCORECARD: EvidenceScorecard = {
  overallScore: 82,
  checks: [
    { title: 'Title Ownership Proof', status: 'pass', note: '1995 Sale Deed + Death Cert in order' },
    { title: 'Co-heirship Proof', status: 'pass', note: 'Legal Heirship Certificate verified' },
    { title: 'Physical Possession Proof', status: 'pass', note: 'Tax receipts & EB bills present' },
    { title: 'Admissibility of Digital Evidence', status: 'warning', note: 'WhatsApp chats need Sec 65B Affidavit' },
    { title: 'Independent Witness Affidavit', status: 'fail', note: 'No neighbor statement filed yet' }
  ],
  missingCriticalEvidence: [
    'Sec 65B Electronic Evidence Affidavit for WhatsApp chat',
    'Certified FMB Survey Sketch from Tahsildar',
    'Encumbrance Certificate from SRO for 30 years'
  ]
};

export const SAMPLE_TIMELINE: TimelineNode[] = [
  { id: 't1', date: '1995-04-12', event: 'Father purchased Mylapore 2400 sq ft property (Doc 1204/1995)', category: 'Property' },
  { id: 't2', date: '2020-09-18', event: 'Father K. Ramachandran passed away intestate', category: 'Property' },
  { id: 't3', date: '2021-03-05', event: 'Suresh drafted Unregistered Partition Deed (₹100 stamp paper)', category: 'Property', flag: 'Invalid Stamp Duty' },
  { id: 't4', date: '2026-05-22', event: 'Suresh acknowledged 50% share in WhatsApp chat', category: 'Communication', flag: 'Key Admission' },
  { id: 't5', date: '2026-06-14', event: 'Suresh sold entire property to Star Builders (Doc 4012/2026)', category: 'Transaction', flag: 'Impugned Sale' },
  { id: 't6', date: '2026-07-10', event: 'Ramesh served Advocate Legal Notice for Cancellation of Sale', category: 'Notice' },
  { id: 't7', date: '2026-07-20', event: 'Plaint O.S. 402/2024 filed in City Civil Court', category: 'Court Filing' }
];

export const SAMPLE_CONTRADICTIONS: ContradictionItem[] = [
  {
    id: 'c1',
    statementA: { text: 'Payment of ₹10 Lakhs earnest money was made on 15 June 2026 in cash.', source: 'Affidavit of Builder Suresh', date: '2026-06-15' },
    statementB: { text: 'Bank Statement shows ₹10 Lakhs RTGS transfer on 20 June 2026, no cash deposit.', source: 'HDFC Bank Account Statement', date: '2026-06-20' },
    natureOfContradiction: 'Discrepancy in mode and date of earnest payment.',
    impactOnCase: 'Moderate',
    recommendedVerification: 'Cross-examine defendant on why affidavit says June 15 cash when RTGS was June 20.'
  },
  {
    id: 'c2',
    statementA: { text: 'Suresh acquired exclusive ownership via oral family arrangement in Aug 2020.', source: 'Recital 3 of Sale Deed 4012/2026', date: '2026-06-14' },
    statementB: { text: 'In March 2021, Suresh presented written partition deed claiming joint tenancy till date.', source: 'Unregistered Partition Deed', date: '2021-03-05' },
    natureOfContradiction: 'Conflicting dates for alleged division of ancestral rights.',
    impactOnCase: 'Severe',
    recommendedVerification: 'Use in Cross-Examination to shatter defense of exclusive oral partition.'
  }
];

export const SAMPLE_CALENDAR: CalendarEvent[] = [
  {
    id: 'cal-1',
    caseId: 'case-103',
    caseTitle: 'State vs. Vikram Anand',
    court: 'Principal Sessions Court - Hall 4',
    hearingType: 'Bail Argument',
    date: '2026-07-30',
    time: '10:30 AM',
    judge: 'Hon. S. Bhaskar',
    status: 'Scheduled'
  },
  {
    id: 'cal-2',
    caseId: 'case-101',
    caseTitle: 'Ramesh Kumar vs. Suresh Kumar',
    court: 'City Civil Court Chennai - XVIII Asst',
    hearingType: 'Injunction Order & Issues',
    date: '2026-08-05',
    time: '11:15 AM',
    judge: 'Hon. M. Swaminathan',
    status: 'Scheduled'
  },
  {
    id: 'cal-3',
    caseId: 'case-102',
    caseTitle: 'M/S Apex Tech vs Vertex Infra',
    court: 'High Court Commercial Division',
    hearingType: 'Admission & Notice',
    date: '2026-08-12',
    time: '02:15 PM',
    judge: 'Hon. K. Rangarajan',
    status: 'Scheduled'
  }
];

export const SAMPLE_TASKS: PracticeTask[] = [
  {
    id: 'task-1',
    caseId: 'case-101',
    title: 'File Sec 65B Affidavit for WhatsApp chat evidence',
    dueDate: '2026-08-02',
    priority: 'High',
    status: 'Pending',
    category: 'Evidence Collection',
    assignedTo: 'Junior Associate Ananya'
  },
  {
    id: 'task-2',
    caseId: 'case-101',
    title: 'Draft Interim Injunction Petition against Star Builders',
    dueDate: '2026-08-03',
    priority: 'High',
    status: 'In Progress',
    category: 'Drafting',
    assignedTo: 'Advocate Advocate360 AI'
  },
  {
    id: 'task-3',
    caseId: 'case-102',
    title: 'Obtain Certified Encumbrance Certificate from SRO Mylapore',
    dueDate: '2026-08-04',
    priority: 'Medium',
    status: 'Pending',
    category: 'Client Follow-up',
    assignedTo: 'Court Clerk Murugan'
  }
];

export const SAMPLE_FEES: FeeRecord[] = [
  {
    id: 'fee-1',
    caseId: 'case-101',
    clientName: 'Ramesh Kumar',
    totalFee: 150000,
    paidAmount: 75000,
    pendingAmount: 75000,
    dueDate: '2026-08-10',
    status: 'Partially Paid'
  },
  {
    id: 'fee-2',
    caseId: 'case-102',
    clientName: 'M/S Apex Tech Ltd',
    totalFee: 250000,
    paidAmount: 250000,
    pendingAmount: 0,
    dueDate: '2026-07-15',
    status: 'Paid'
  },
  {
    id: 'fee-3',
    caseId: 'case-103',
    clientName: 'Priya Anand',
    totalFee: 80000,
    paidAmount: 20000,
    pendingAmount: 60000,
    dueDate: '2026-07-29',
    status: 'Overdue'
  }
];

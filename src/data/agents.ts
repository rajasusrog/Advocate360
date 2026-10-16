import { AgentInfo } from '../types';

export const ADVOCATE_AGENTS: AgentInfo[] = [
  {
    id: 'document_intelligence',
    name: 'Document Intelligence Agent',
    iconName: 'BookOpen',
    title: '📚 Case File & Document Intelligence',
    description: 'Reads multi-page deeds, FIRs, notices & agreements. Extracts 15 key facts, timelines, contradictions & missing evidence.',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    id: 'legal_research',
    name: 'Legal Research Agent',
    iconName: 'Scale',
    title: '⚖️ Case Law & Statutory Research',
    description: 'Finds statutory provisions, landmark judgment precedents, ratio decidendi, and supporting/opposing principles.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    id: 'drafting',
    name: 'Drafting Agent',
    iconName: 'FileText',
    title: '📄 Court Drafting & Pleading Assistant',
    description: 'Drafts legal notices, plaints, affidavits, written statements, bail applications, and prayers with proper formatting.',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  {
    id: 'evidence_analysis',
    name: 'Evidence Analysis Agent',
    iconName: 'CheckCircle2',
    title: '🧾 Evidence Intelligence & Scorecard',
    description: 'Evaluates evidentiary value, links documents to facts, tracks gaps, and computes case evidence scorecards.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    id: 'court_hearing',
    name: 'Court & Hearing Agent',
    iconName: 'Calendar',
    title: '📅 Hearing Brief & Calendar Manager',
    description: 'Prepares tomorrow hearing briefs, opponent argument counters, client Q&A, and courtroom checklists.',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  {
    id: 'case_strategy',
    name: 'Case Strategy Agent',
    iconName: 'Target',
    title: '🔍 Case Strategy & Contradictions',
    description: 'Highlights strengths, weaknesses, limitation traps, contradiction alerts, and cross-examination questions.',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  },
  {
    id: 'client_communication',
    name: 'Client Communication Agent',
    iconName: 'MessageSquare',
    title: '💬 Client Intake & Chat Assistant',
    description: 'Handles 24x7 client intake chats, routine status queries, document requests, and layman case updates.',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200'
  },
  {
    id: 'compliance_procedure',
    name: 'Compliance & Procedure Agent',
    iconName: 'ShieldAlert',
    title: '🏛️ Limitation & Court Procedure Agent',
    description: 'Checks Limitation Act timelines, stamp duty compliance, court fees, jurisdiction, and procedural readiness.',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200'
  }
];

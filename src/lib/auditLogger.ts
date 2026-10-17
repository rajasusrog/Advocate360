import { AuditLog } from '../types';

type AuditSubscriber = (logs: AuditLog[]) => void;

let inMemoryAuditLogs: AuditLog[] = [
  {
    id: 'log-101',
    chamberId: 'chamber-default',
    actorUid: 'usr-senior-1',
    actorEmail: 'senior.advocate@chamber.legal',
    action: 'CASE_CREATE',
    details: 'Created matter: Ancestral Property Injunction Suit (Mylapore Division)',
    timestamp: '2026-07-29 18:20:10'
  },
  {
    id: 'log-102',
    chamberId: 'chamber-default',
    actorUid: 'usr-junior-1',
    actorEmail: 'junior.associate@chamber.legal',
    action: 'AI_GENERATION',
    details: 'AI Agent Execution: Drafted Order 39 Injunction Interlocutory Petition',
    timestamp: '2026-07-29 18:35:42'
  },
  {
    id: 'log-103',
    chamberId: 'chamber-default',
    actorUid: 'usr-senior-1',
    actorEmail: 'senior.advocate@chamber.legal',
    action: 'ROLE_CHANGE',
    details: 'RBAC Policy Update: Elevated Associate role to Junior Advocate',
    timestamp: '2026-07-29 18:50:00'
  }
];

const subscribers: Set<AuditSubscriber> = new Set();

export function getAuditLogs(): AuditLog[] {
  return [...inMemoryAuditLogs];
}

export function subscribeAuditLogs(callback: AuditSubscriber): () => void {
  subscribers.add(callback);
  callback([...inMemoryAuditLogs]);
  return () => subscribers.delete(callback);
}

export function logAuditEvent(
  action: AuditLog['action'],
  details: string,
  metaOrActorEmail?: string | { chamberId?: string; caseId?: string; docId?: string; actorEmail?: string; actorUid?: string },
  actorUid: string = 'usr-current'
): AuditLog {
  let chamberId = 'chamber-default';
  let email = 'advocate@chamber.legal';
  let uid = actorUid;

  if (typeof metaOrActorEmail === 'string') {
    email = metaOrActorEmail;
  } else if (metaOrActorEmail && typeof metaOrActorEmail === 'object') {
    chamberId = metaOrActorEmail.chamberId || chamberId;
    email = metaOrActorEmail.actorEmail || email;
    uid = metaOrActorEmail.actorUid || uid;
  }

  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    chamberId,
    actorUid: uid,
    actorEmail: email,
    action,
    details,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  inMemoryAuditLogs = [newLog, ...inMemoryAuditLogs];
  subscribers.forEach(sub => sub([...inMemoryAuditLogs]));

  console.log('[AUDIT LOG]', newLog.timestamp, action, details);
  return newLog;
}

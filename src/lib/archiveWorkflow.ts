import { CaseFile, ArchivePolicySettings } from '../types';
import { logAuditEvent } from './auditLogger';

export const DEFAULT_ARCHIVE_POLICY: ArchivePolicySettings = {
  enabled: true,
  inactivityDays: 90,
  autoArchiveClosed: true,
  lastSweepRun: new Date().toISOString()
};

const STORAGE_KEY = 'adv360_archive_policy_settings';

/**
 * Loads current chamber archive policy settings
 */
export function getStoredArchivePolicy(): ArchivePolicySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_ARCHIVE_POLICY, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_ARCHIVE_POLICY;
}

/**
 * Saves chamber archive policy settings
 */
export function saveStoredArchivePolicy(policy: ArchivePolicySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
  } catch {
    // ignore
  }
}

/**
 * Calculates number of elapsed days since the last recorded case activity or update
 */
export function getCaseInactivityDays(c: CaseFile): number {
  const dateStr = c.lastActivityDate || c.updatedAt || c.createdAt;
  if (!dateStr) return 0;
  
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return 0;
  
  const diffMs = Math.max(0, Date.now() - dateObj.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Runs the automated inactivity sweep across all chamber cases.
 * Cases that exceed policy.inactivityDays without active hearings/updates are transitioned to 'Archived'.
 */
export function runInactivityArchiveSweep(
  cases: CaseFile[],
  policy: ArchivePolicySettings = DEFAULT_ARCHIVE_POLICY
): {
  updatedCases: CaseFile[];
  archivedCases: CaseFile[];
  count: number;
} {
  if (!policy.enabled) {
    return { updatedCases: cases, archivedCases: [], count: 0 };
  }

  const nowIso = new Date().toISOString();
  const newlyArchived: CaseFile[] = [];

  const updatedCases = cases.map((c) => {
    // If already archived, retain
    if (c.status === 'Archived') {
      return c;
    }

    const daysInactive = getCaseInactivityDays(c);
    const isOverThreshold = daysInactive >= policy.inactivityDays;
    const isClosedAutoArchive = policy.autoArchiveClosed && c.status === 'Closed' && daysInactive >= 14;

    if (isOverThreshold || isClosedAutoArchive) {
      const reason = isClosedAutoArchive 
        ? `Closed matter auto-archived after 14 days of closure.`
        : `Automated inactivity policy: ${daysInactive} days without docket updates (threshold: ${policy.inactivityDays} days).`;

      const archivedCase: CaseFile = {
        ...c,
        previousStatus: c.status,
        status: 'Archived',
        archivedAt: nowIso,
        archivedReason: reason
      };

      newlyArchived.push(archivedCase);
      logAuditEvent(
        'CASE_UPDATE',
        `Automated Archive Workflow: Moved matter "${c.title}" (${c.caseNumber || 'NO-NUM'}) to Archived. Reason: ${reason}`
      );

      return archivedCase;
    }

    return c;
  });

  return {
    updatedCases,
    archivedCases: newlyArchived,
    count: newlyArchived.length
  };
}

/**
 * Restores an archived case back to active status in the dashboard pipeline
 */
export function restoreCaseFromArchive(
  caseId: string,
  cases: CaseFile[]
): { updatedCases: CaseFile[]; restoredCase?: CaseFile } {
  let restored: CaseFile | undefined;
  const nowStr = new Date().toISOString().split('T')[0];

  const updatedCases = cases.map((c) => {
    if (c.id === caseId && c.status === 'Archived') {
      const nextStatus = (c.previousStatus as any) || 'Analysis';
      restored = {
        ...c,
        status: nextStatus === 'Archived' ? 'Analysis' : nextStatus,
        updatedAt: nowStr,
        lastActivityDate: nowStr,
        archivedAt: undefined,
        archivedReason: undefined
      };

      logAuditEvent(
        'CASE_UPDATE',
        `Advocate restored matter "${c.title}" from Archived status back to active pipeline (${restored.status})`
      );

      return restored;
    }
    return c;
  });

  return { updatedCases, restoredCase: restored };
}

/**
 * Manually archives an active case with advocate notes
 */
export function archiveCaseManually(
  caseId: string,
  cases: CaseFile[],
  reason = 'Manually archived by Advocate to reduce active pipeline clutter.'
): CaseFile[] {
  const nowIso = new Date().toISOString();
  return cases.map((c) => {
    if (c.id === caseId) {
      const archived: CaseFile = {
        ...c,
        previousStatus: c.status,
        status: 'Archived',
        archivedAt: nowIso,
        archivedReason: reason
      };
      logAuditEvent('CASE_UPDATE', `Manually archived matter: "${c.title}". Reason: ${reason}`);
      return archived;
    }
    return c;
  });
}

import { ChamberRole } from '../types';

export type GranularPermission =
  | 'case.create'
  | 'case.read'
  | 'case.update'
  | 'case.delete'
  | 'client.edit'
  | 'document.upload'
  | 'document.export'
  | 'billing.view'
  | 'billing.edit'
  | 'workflow.create'
  | 'workflow.manage'
  | 'workflow.approve'
  | 'ai.execute'
  | 'audit.read'
  | 'audit.view'
  | 'settings.manage'
  | 'signature.apply'
  | 'branch.manage';

export const ROLE_GRANULAR_PERMISSIONS: Record<ChamberRole, GranularPermission[]> = {
  CHAMBER_OWNER: [
    'case.create', 'case.read', 'case.update', 'case.delete',
    'client.edit', 'document.upload', 'document.export',
    'billing.view', 'billing.edit',
    'workflow.create', 'workflow.manage', 'workflow.approve',
    'ai.execute', 'audit.read', 'audit.view', 'settings.manage',
    'signature.apply', 'branch.manage'
  ],
  SENIOR_ADVOCATE: [
    'case.create', 'case.read', 'case.update', 'case.delete',
    'client.edit', 'document.upload', 'document.export',
    'billing.view', 'billing.edit',
    'workflow.create', 'workflow.manage', 'workflow.approve',
    'ai.execute', 'audit.read', 'audit.view', 'settings.manage',
    'signature.apply', 'branch.manage'
  ],
  ADVOCATE: [
    'case.create', 'case.read', 'case.update',
    'client.edit', 'document.upload', 'document.export',
    'billing.view',
    'workflow.create', 'workflow.approve',
    'ai.execute', 'signature.apply'
  ],
  JUNIOR_ADVOCATE: [
    'case.create', 'case.read', 'case.update',
    'document.upload', 'document.export',
    'workflow.create',
    'ai.execute'
  ],
  ASSOCIATE: [
    'case.read', 'case.update',
    'document.upload', 'document.export',
    'ai.execute'
  ],
  PARALEGAL: [
    'case.read',
    'document.upload',
    'ai.execute'
  ],
  CLERK: [
    'case.read',
    'document.upload'
  ],
  RECEPTIONIST: [
    'case.read',
    'client.edit'
  ],
  CLIENT: [
    'case.read',
    'document.upload'
  ],
  EXTERNAL_COUNSEL: [
    'case.read',
    'document.export',
    'ai.execute'
  ],
  ADMINISTRATOR: [
    'case.read',
    'audit.read', 'audit.view', 'settings.manage', 'branch.manage'
  ],
  READ_ONLY: [
    'case.read'
  ]
};

export type PermissionAction =
  | 'DELETE_CASE'
  | 'DELETE_EVIDENCE'
  | 'DELETE_DOCUMENT'
  | 'EDIT_BILLING'
  | 'MANAGE_ROLES'
  | 'APPROVE_DRAFT'
  | 'EXPORT_PDF'
  | 'VIEW_AUDIT_LOGS'
  | 'MANAGE_BACKUPS'
  | 'CREATE_CASE'
  | 'EDIT_CASE'
  | 'VIEW_CASES'
  | 'RUN_AI_AGENT'
  | 'SIGN_DIGITAL_DOC';

export function hasPermission(role: ChamberRole, action: PermissionAction | GranularPermission): boolean {
  if (action.includes('.')) {
    const allowed = ROLE_GRANULAR_PERMISSIONS[role] || [];
    return allowed.includes(action as GranularPermission);
  }

  // Fallback map for legacy action names
  const mapping: Record<PermissionAction, GranularPermission> = {
    'DELETE_CASE': 'case.delete',
    'DELETE_EVIDENCE': 'case.update',
    'DELETE_DOCUMENT': 'case.update',
    'EDIT_BILLING': 'billing.edit',
    'MANAGE_ROLES': 'settings.manage',
    'APPROVE_DRAFT': 'workflow.approve',
    'EXPORT_PDF': 'document.export',
    'VIEW_AUDIT_LOGS': 'audit.view',
    'MANAGE_BACKUPS': 'settings.manage',
    'CREATE_CASE': 'case.create',
    'EDIT_CASE': 'case.update',
    'VIEW_CASES': 'case.read',
    'RUN_AI_AGENT': 'ai.execute',
    'SIGN_DIGITAL_DOC': 'signature.apply'
  };

  const reqGranular = mapping[action as PermissionAction];
  const allowed = ROLE_GRANULAR_PERMISSIONS[role] || [];
  return allowed.includes(reqGranular);
}

export function getPermissionDeniedReason(role: ChamberRole, action: string): string {
  return `Role "${role.replace('_', ' ')}" lacks required permission "${action}". Access denied. Contact Chamber Senior Advocate or Administrator to grant access.`;
}

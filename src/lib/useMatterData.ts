import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CaseFile,
  CaseAssessment,
  PracticeTask,
  EvidenceItem,
  ChamberProfile,
  ChamberRole,
  UserProfile,
  EnterpriseDoc,
  DocumentVersion,
  TimelineNode,
  TimeLog,
  Invoice,
  InvoicePayment,
  CalendarEvent,
} from '../types';
import { logAuditEvent } from './auditLogger';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Formats exact byte count into human-readable string without ever inventing placeholder sizes.
 */
export function formatFileSizeBytes(bytes: number | string | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === '') return '0 B';
  const num = typeof bytes === 'number' ? bytes : Number(bytes);
  if (Number.isNaN(num) || num <= 0) return '0 B';
  if (num < 1024) return `${Math.round(num)} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Bidirectional mapper: PostgreSQL `public.matters` row -> UI `CaseFile`
 */
export function mapMatterRowToCaseFile(row: any): CaseFile {
  const createdDate = row.created_at
    ? String(row.created_at).split('T')[0]
    : new Date().toISOString().split('T')[0];
  const updatedDate = row.updated_at
    ? String(row.updated_at).split('T')[0]
    : createdDate;

  return {
    id: row.id,
    chamberId: row.workspace_id,
    title: row.title || 'Untitled Matter',
    caseNumber: row.case_number || undefined,
    caseType: (row.case_type as CaseFile['caseType']) || 'Property Dispute',
    status: (row.status as CaseFile['status']) || (row.stage as CaseFile['status']) || 'Intake',
    clientName: row.client_name || 'Client',
    clientPhone: row.client_phone || undefined,
    clientEmail: row.client_email || undefined,
    oppositeParty: row.opposite_party || undefined,
    courtName: row.court_name || 'Court Not Specified',
    judgeName: row.judge_name || undefined,
    nextHearingDate: row.next_hearing_date ? String(row.next_hearing_date).split('T')[0] : undefined,
    stage: row.stage || row.status || 'Intake',
    summary: row.summary || '',
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    caseAssessment:
      row.case_assessment && typeof row.case_assessment === 'object'
        ? (row.case_assessment as CaseAssessment)
        : undefined,
    memory: row.memory && typeof row.memory === 'object' ? row.memory : undefined,
    workflowStages: Array.isArray(row.workflow_stages) ? row.workflow_stages : undefined,
    createdAt: createdDate,
    updatedAt: updatedDate,
    archivedAt: row.archived_at || undefined,
    archivedReason: row.archived_reason || undefined,
    previousStatus: row.previous_status || undefined,
    lastActivityDate: row.last_activity_date
      ? String(row.last_activity_date).split('T')[0]
      : updatedDate,
  };
}

/**
 * Bidirectional mapper: UI `CaseFile` -> PostgreSQL `public.matters` row payload
 */
export function mapCaseFileToMatterRow(
  matter: Partial<CaseFile>,
  workspaceId: string
): Record<string, any> {
  const payload: Record<string, any> = {
    workspace_id: workspaceId,
    updated_at: new Date().toISOString(),
  };

  if (
    matter.id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matter.id)
  ) {
    payload.id = matter.id;
  }
  if (matter.title !== undefined) payload.title = matter.title;
  if (matter.caseNumber !== undefined) payload.case_number = matter.caseNumber || null;
  if (matter.courtName !== undefined) payload.court_name = matter.courtName || null;
  if (matter.judgeName !== undefined) payload.judge_name = matter.judgeName || null;
  if (matter.stage !== undefined) payload.stage = matter.stage || matter.status || 'Intake';
  if (matter.status !== undefined) {
    payload.status = matter.status;
    if (matter.stage === undefined) payload.stage = matter.status;
  }
  if (matter.caseType !== undefined) payload.case_type = matter.caseType;
  if (matter.clientName !== undefined) payload.client_name = matter.clientName;
  if (matter.clientPhone !== undefined) payload.client_phone = matter.clientPhone || null;
  if (matter.clientEmail !== undefined) payload.client_email = matter.clientEmail || null;
  if (matter.oppositeParty !== undefined) payload.opposite_party = matter.oppositeParty || null;
  if (matter.nextHearingDate !== undefined) {
    payload.next_hearing_date = matter.nextHearingDate || null;
  }
  if (matter.summary !== undefined) payload.summary = matter.summary || '';
  if (matter.timeline !== undefined) payload.timeline = matter.timeline || [];
  if (matter.caseAssessment !== undefined) payload.caseAssessment = matter.caseAssessment || {};
  if (matter.caseAssessment !== undefined) {
    delete payload.caseAssessment;
    payload.case_assessment = matter.caseAssessment || {};
  }
  if (matter.memory !== undefined) payload.memory = matter.memory || {};
  if (matter.workflowStages !== undefined) payload.workflow_stages = matter.workflowStages || [];
  if (matter.archivedAt !== undefined) payload.archived_at = matter.archivedAt || null;
  if (matter.archivedReason !== undefined) payload.archived_reason = matter.archivedReason || null;
  if (matter.previousStatus !== undefined) payload.previous_status = matter.previousStatus || null;

  return payload;
}

/**
 * Explicit mapper: PostgreSQL `public.documents` + `public.document_versions` -> UI `EnterpriseDoc`
 * Never invents file sizes, extracted content, or indexing statuses.
 */
export function mapDocumentRowToEnterpriseDoc(
  docRow: any,
  versionRows: any[] = []
): EnterpriseDoc {
  const fileSizeBytes =
    typeof docRow.file_size === 'number'
      ? docRow.file_size
      : Number(docRow.file_size ?? 0) || 0;
  const formattedDocSize = formatFileSizeBytes(fileSizeBytes);
  const processingStatus = docRow.processing_status || 'Uploaded';
  const reviewStatus = docRow.review_status || 'Unreviewed';
  const extractedText = docRow.extracted_text ?? '';
  const currentVersion = Number(docRow.current_version ?? 1);
  const uploadDate = docRow.created_at ? String(docRow.created_at).split('T')[0] : '';

  const sortedVersions = [...versionRows].sort(
    (a, b) => Number(b.version ?? 0) - Number(a.version ?? 0)
  );

  const mappedVersions: DocumentVersion[] =
    sortedVersions.length > 0
      ? sortedVersions.map((v) => {
          const verBytes =
            v.file_size !== null && v.file_size !== undefined
              ? Number(v.file_size)
              : fileSizeBytes;
          const verText = v.extracted_text ?? extractedText ?? '';
          const verNumber = Number(v.version ?? 1);
          const clauseCount = verText
            ? Math.max(
                1,
                String(verText)
                  .split(/\n\s*\n/)
                  .filter((p) => p.trim().length > 0).length
              )
            : 0;

          return {
            id: v.id,
            versionNumber: verNumber,
            versionLabel: `v${verNumber} — ${v.changes_summary || 'Document version'}`,
            timestamp: v.created_at
              ? String(v.created_at).replace('T', ' ').substring(0, 16)
              : uploadDate,
            author: v.author_name || v.created_by_user_id || 'Workspace Member',
            authorRole: 'Advocate',
            changesSummary: v.changes_summary || '',
            fileSize: formatFileSizeBytes(verBytes),
            fileSizeBytes: verBytes,
            filePath: v.file_path || docRow.file_path,
            mimeType: v.mime_type || docRow.mime_type || 'application/octet-stream',
            ocrStatus: processingStatus,
            clauseCount,
            content: verText,
          };
        })
      : [];

  return {
    id: docRow.id,
    workspaceId: docRow.workspace_id,
    matterId: docRow.matter_id,
    name: docRow.name,
    version: currentVersion,
    size: formattedDocSize,
    fileSizeBytes,
    mimeType: docRow.mime_type || 'application/octet-stream',
    filePath: docRow.file_path,
    storageBucket: docRow.storage_bucket || 'matter-documents',
    type: docRow.doc_type || 'Document',
    uploadedBy: docRow.uploaded_by_user_id || 'Workspace Member',
    uploadDate,
    ocrStatus: processingStatus,
    processingStatus,
    reviewStatus,
    content: extractedText,
    versions: mappedVersions,
  };
}

/**
 * Atomic workspace creation via Supabase PostgreSQL RPC `create_workspace_with_owner`
 */
export async function createWorkspaceWithOwner(
  setupData: {
    advocateName: string;
    chamberName: string;
    enrollmentNo: string;
    stateBarCouncil: string;
    officeLocation: string;
    phone: string;
    email?: string;
    practiceAreas: string[];
  },
  userUid: string,
  client: SupabaseClient = supabase
): Promise<{ chamber: ChamberProfile; membershipId: string; role: ChamberRole }> {
  const { data: rpcResult, error: rpcError } = await client.rpc('create_workspace_with_owner', {
    ws_name: setupData.chamberName,
    adv_name: setupData.advocateName,
    ws_city: setupData.officeLocation,
    bar_enrollment: setupData.enrollmentNo,
    bar_council: setupData.stateBarCouncil,
    ws_phone: setupData.phone,
    ws_email: setupData.email || '',
    ws_practice_areas: setupData.practiceAreas,
  });

  if (rpcError || !rpcResult?.workspace_id) {
    throw new Error(rpcError?.message || 'Failed to execute create_workspace_with_owner RPC');
  }

  const workspaceId: string = rpcResult.workspace_id;
  const membershipId: string = rpcResult.membership_id;
  const nowIso = new Date().toISOString();

  const chamber: ChamberProfile = {
    id: workspaceId,
    name: setupData.chamberName,
    ownerUid: userUid,
    advocateName: setupData.advocateName,
    enrollmentNo: setupData.enrollmentNo,
    stateBarCouncil: setupData.stateBarCouncil,
    officeLocation: setupData.officeLocation,
    phone: setupData.phone,
    email: setupData.email || '',
    practiceAreas: setupData.practiceAreas,
    createdAt: nowIso,
  };

  return {
    chamber,
    membershipId,
    role: 'CHAMBER_OWNER',
  };
}

/**
 * Fetch active workspace membership & chamber profile for authenticated Supabase user
 */
export async function fetchUserWorkspaceMembership(
  userId: string,
  userEmail: string = '',
  client: SupabaseClient = supabase
): Promise<{
  chamber: ChamberProfile | null;
  role: ChamberRole;
  profile: UserProfile | null;
}> {
  const { data: memberships, error: memErr } = await client
    .from('workspace_memberships')
    .select('id, workspace_id, role, status, workspaces(*)')
    .eq('user_id', userId)
    .eq('status', 'Active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (memErr) {
    throw new Error(memErr.message);
  }

  if (!memberships || memberships.length === 0) {
    return { chamber: null, role: 'CHAMBER_OWNER', profile: null };
  }

  const activeMembership: any = memberships[0];
  const wsRow: any = Array.isArray(activeMembership.workspaces)
    ? activeMembership.workspaces[0]
    : activeMembership.workspaces;

  let resolvedWorkspace = wsRow;
  if (!resolvedWorkspace && activeMembership.workspace_id) {
    const { data: fetchedWs, error: wsErr } = await client
      .from('workspaces')
      .select('*')
      .eq('id', activeMembership.workspace_id)
      .maybeSingle();
    if (wsErr) {
      throw new Error(wsErr.message);
    }
    resolvedWorkspace = fetchedWs;
  }

  if (!resolvedWorkspace) {
    return { chamber: null, role: 'CHAMBER_OWNER', profile: null };
  }

  const role = (activeMembership.role as ChamberRole) || 'CHAMBER_OWNER';

  const chamber: ChamberProfile = {
    id: resolvedWorkspace.id,
    name: resolvedWorkspace.name,
    ownerUid: resolvedWorkspace.owner_user_id || userId,
    advocateName: resolvedWorkspace.advocate_name || 'Advocate',
    enrollmentNo: resolvedWorkspace.enrollment_no || '',
    stateBarCouncil: resolvedWorkspace.state_bar_council || '',
    officeLocation: resolvedWorkspace.office_location || resolvedWorkspace.city || '',
    phone: resolvedWorkspace.phone || '',
    email: resolvedWorkspace.email || userEmail,
    practiceAreas: Array.isArray(resolvedWorkspace.practice_areas)
      ? resolvedWorkspace.practice_areas
      : [],
    createdAt: resolvedWorkspace.created_at || new Date().toISOString(),
  };

  const profile: UserProfile = {
    uid: userId,
    displayName: chamber.advocateName,
    email: userEmail,
    chamberId: chamber.id,
    role,
    createdAt: chamber.createdAt,
  };

  return { chamber, role, profile };
}

/**
 * Matter CRUD: List all matters in workspace from PostgreSQL
 */
export async function listMattersForWorkspace(
  workspaceId: string,
  client: SupabaseClient = supabase
): Promise<CaseFile[]> {
  if (!workspaceId) return [];
  const { data, error } = await client
    .from('matters')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapMatterRowToCaseFile);
}

/**
 * Matter CRUD: Get single matter by ID from PostgreSQL
 */
export async function getMatterById(
  workspaceId: string,
  matterId: string,
  client: SupabaseClient = supabase
): Promise<CaseFile | null> {
  if (!workspaceId || !matterId) return null;
  const { data, error } = await client
    .from('matters')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', matterId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapMatterRowToCaseFile(data);
}

/**
 * Matter CRUD: Create new matter in PostgreSQL with atomic client creation
 * or explicit compensating rollback if matter insertion fails after client creation.
 */
export async function createMatterInDb(
  workspaceId: string,
  newCase: CaseFile,
  client: SupabaseClient = supabase
): Promise<CaseFile> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to create a matter');
  }
  if (!newCase.title || !newCase.title.trim()) {
    throw new Error('Matter title is required');
  }

  const { data, error } = await client.rpc('create_matter_with_client', {
    p_workspace_id: workspaceId,
    p_title: newCase.title.trim(),
    p_client_name: newCase.clientName || null,
    p_case_number: newCase.caseNumber || null,
    p_case_type: newCase.caseType || 'Property Dispute',
    p_status: newCase.status || newCase.stage || 'Intake',
    p_client_phone: newCase.clientPhone || null,
    p_client_email: newCase.clientEmail || null,
    p_opposite_party: newCase.oppositeParty || null,
    p_court_name: newCase.courtName || 'Court Not Specified',
    p_judge_name: newCase.judgeName || null,
    p_next_hearing_date: newCase.nextHearingDate || null,
    p_summary: newCase.summary || ''
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create matter in PostgreSQL');
  }

  return mapMatterRowToCaseFile(data);
}

/**
 * Matter CRUD: Update existing matter in PostgreSQL
 */
export async function updateMatterInDb(
  workspaceId: string,
  matterId: string,
  updates: Partial<CaseFile>,
  client: SupabaseClient = supabase
): Promise<CaseFile> {
  if (!workspaceId || !matterId) {
    throw new Error('workspaceId and matterId are required to update a matter');
  }

  const updatePayload = mapCaseFileToMatterRow(updates, workspaceId);
  delete updatePayload.id;

  const { data, error } = await client
    .from('matters')
    .update(updatePayload)
    .eq('workspace_id', workspaceId)
    .eq('id', matterId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update matter in PostgreSQL');
  }

  return mapMatterRowToCaseFile(data);
}

// ============================================================================
// TASKS PERSISTENCE (`public.tasks`)
// ============================================================================

export function mapTaskRowToPracticeTask(row: any): PracticeTask {
  return {
    id: row.id,
    caseId: row.matter_id || undefined,
    title: row.title,
    dueDate: row.due_date ? String(row.due_date).split('T')[0] : '',
    priority: (row.priority as PracticeTask['priority']) || 'Medium',
    status: (row.status as PracticeTask['status']) || 'Pending',
    category: (row.category as PracticeTask['category']) || 'Drafting',
    assignedTo: row.assignee_name || undefined,
    dependsOn: row.dependency_task_id ? [row.dependency_task_id] : [],
  };
}

export async function listTasksForWorkspace(
  workspaceId: string,
  matterId?: string,
  client: SupabaseClient = supabase
): Promise<PracticeTask[]> {
  if (!workspaceId) return [];
  let query = client.from('tasks').select('*').eq('workspace_id', workspaceId);
  if (matterId) {
    query = query.eq('matter_id', matterId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }
  return (data || []).map(mapTaskRowToPracticeTask);
}

export async function createTaskInDb(
  workspaceId: string,
  newTask: Partial<PracticeTask> & { title: string },
  client: SupabaseClient = supabase
): Promise<PracticeTask> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to create a task');
  }
  if (!newTask.title || !newTask.title.trim()) {
    throw new Error('Task title is required');
  }

  const dependencyId =
    Array.isArray(newTask.dependsOn) && newTask.dependsOn.length > 0
      ? newTask.dependsOn[0]
      : null;

  const isUuid = (val?: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const insertPayload: Record<string, any> = {
    workspace_id: workspaceId,
    matter_id: isUuid(newTask.caseId) ? newTask.caseId : null,
    title: newTask.title.trim(),
    category: newTask.category || 'Drafting',
    due_date: newTask.dueDate ? newTask.dueDate : null,
    priority: newTask.priority || 'Medium',
    status: newTask.status || 'Pending',
    assignee_name: newTask.assignedTo || null,
    dependency_task_id: isUuid(dependencyId) ? dependencyId : null,
  };

  if (isUuid(newTask.id)) {
    insertPayload.id = newTask.id;
  }

  const { data, error } = await client
    .from('tasks')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create task in PostgreSQL');
  }

  return mapTaskRowToPracticeTask(data);
}

export async function updateTaskInDb(
  workspaceId: string,
  taskId: string,
  updates: Partial<PracticeTask>,
  client: SupabaseClient = supabase
): Promise<PracticeTask> {
  if (!workspaceId || !taskId) {
    throw new Error('workspaceId and taskId are required to update a task');
  }

  const isUuid = (val?: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate || null;
  if (updates.assignedTo !== undefined) payload.assignee_name = updates.assignedTo || null;
  if (updates.dependsOn !== undefined) {
    const depId = updates.dependsOn[0] || null;
    payload.dependency_task_id = isUuid(depId) ? depId : null;
  }

  const { data, error } = await client
    .from('tasks')
    .update(payload)
    .eq('workspace_id', workspaceId)
    .eq('id', taskId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update task in PostgreSQL');
  }

  return mapTaskRowToPracticeTask(data);
}

export async function toggleTaskStatusInDb(
  workspaceId: string,
  taskId: string,
  currentStatus: PracticeTask['status'],
  client: SupabaseClient = supabase
): Promise<PracticeTask> {
  const nextStatus: PracticeTask['status'] =
    currentStatus === 'Completed' ? 'Pending' : 'Completed';
  return updateTaskInDb(workspaceId, taskId, { status: nextStatus }, client);
}

// ============================================================================
// DOCUMENTS, IMMUTABLE DOCUMENT VERSIONS & PRIVATE SUPABASE STORAGE
// ============================================================================

export async function listDocumentsWithVersions(
  workspaceId: string,
  matterId?: string,
  client: SupabaseClient = supabase
): Promise<EnterpriseDoc[]> {
  if (!workspaceId) return [];

  let docQuery = client.from('documents').select('*').eq('workspace_id', workspaceId);
  if (matterId) {
    docQuery = docQuery.eq('matter_id', matterId);
  }
  const { data: docRows, error: docErr } = await docQuery.order('created_at', {
    ascending: false,
  });

  if (docErr) {
    throw new Error(`Failed to query documents: ${docErr.message}`);
  }

  if (!docRows || docRows.length === 0) {
    return [];
  }

  const docIds = docRows.map((d: any) => d.id);
  const { data: versionRows, error: verErr } = await client
    .from('document_versions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('document_id', docIds)
    .order('version', { ascending: false });

  if (verErr) {
    throw new Error(`Failed to query document_versions: ${verErr.message}`);
  }

  const versionsByDocId = new Map<string, any[]>();
  for (const v of versionRows || []) {
    const list = versionsByDocId.get(v.document_id) || [];
    list.push(v);
    versionsByDocId.set(v.document_id, list);
  }

  return docRows.map((d: any) =>
    mapDocumentRowToEnterpriseDoc(d, versionsByDocId.get(d.id) || [])
  );
}

export async function uploadDocumentToStorageAndDb(
  params: {
    workspaceId: string;
    matterId: string;
    fileName: string;
    fileBytes: Uint8Array | ArrayBuffer | Blob;
    fileSize?: number;
    mimeType?: string;
    docType?: string;
    changesSummary?: string;
    extractedText?: string | null;
    uploadedByUserId?: string | null;
    authorName?: string;
    operationId?: string;
  },
  client: SupabaseClient = supabase
): Promise<EnterpriseDoc> {
  const {
    workspaceId,
    matterId,
    fileName,
    fileBytes,
    mimeType = 'application/octet-stream',
    docType = 'Document',
    changesSummary = 'Initial document upload',
    extractedText = null,
    uploadedByUserId = null,
    authorName = 'Workspace Member',
  } = params;

  if (!workspaceId || !matterId) {
    throw new Error('workspaceId and matterId are required for document upload');
  }
  if (!fileName || !fileName.trim()) {
    throw new Error('Document fileName is required');
  }

  const byteLength =
    typeof params.fileSize === 'number'
      ? params.fileSize
      : fileBytes instanceof Uint8Array
        ? fileBytes.byteLength
        : fileBytes instanceof ArrayBuffer
          ? fileBytes.byteLength
          : typeof (fileBytes as Blob)?.size === 'number'
            ? (fileBytes as Blob).size
            : 0;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const attemptUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const operationId = params.operationId || attemptUuid;
  const storageBucket = 'matter-documents';
  const storagePath = `${workspaceId}/${matterId}/${attemptUuid}_v1_${safeName}`;

  // 1. Upload original file bytes to private Supabase Storage bucket
  const { data: storageData, error: storageErr } = await client.storage
    .from(storageBucket)
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (storageErr || !storageData?.path) {
    throw new Error(
      `Private storage upload failed: ${storageErr?.message || 'No storage path returned'}`
    );
  }

  // 2. Commit initial document metadata and version 1 in one atomic database RPC
  const { data: rpcRes, error: rpcErr } = await client.rpc('create_document_with_initial_version_atomic', {
    p_workspace_id: workspaceId,
    p_matter_id: matterId,
    p_name: fileName.trim(),
    p_doc_type: docType,
    p_storage_bucket: storageBucket,
    p_file_path: storagePath,
    p_file_size: byteLength,
    p_mime_type: mimeType,
    p_changes_summary: changesSummary,
    p_extracted_text: extractedText,
    p_author_name: authorName,
    p_operation_id: operationId,
  });

  if (rpcErr || !rpcRes) {
    let cleanupNotice = '';
    try {
      const { error: remErr } = await client.storage.from(storageBucket).remove([storagePath]);
      if (remErr) {
        cleanupNotice = ` (Storage cleanup error: ${remErr.message})`;
      }
    } catch (cleanupErr: any) {
      cleanupNotice = ` (Storage cleanup error: ${cleanupErr?.message || 'Failed to remove orphaned storage object'})`;
    }
    throw new Error(`Database initial document commit failed: ${rpcErr?.message || 'No payload'}${cleanupNotice}`);
  }

  return mapDocumentRowToEnterpriseDoc(rpcRes.document, [rpcRes.version]);
}

/**
 * Commits a new immutable document version (v2, v3, etc.)
 * by uploading version bytes to a unique storage attempt path,
 * locking the document record in PostgreSQL, and committing version metadata transactionally.
 */
export async function createDocumentRevisionInStorageAndDb(
  params: {
    workspaceId: string;
    matterId: string;
    documentId: string;
    fileName: string;
    fileBytes: Uint8Array | ArrayBuffer | Blob;
    fileSize?: number;
    mimeType?: string;
    changesSummary: string;
    extractedText?: string | null;
    createdByUserId?: string | null;
    authorName?: string;
    expectedVersion?: number;
    operationId?: string;
  },
  client: SupabaseClient = supabase
): Promise<EnterpriseDoc> {
  const {
    workspaceId,
    matterId,
    documentId,
    fileName,
    fileBytes,
    mimeType = 'text/plain',
    changesSummary,
    extractedText = null,
    createdByUserId = null,
    authorName = 'Workspace Member',
  } = params;

  if (!workspaceId || !matterId || !documentId) {
    throw new Error('workspaceId, matterId, and documentId are required to create a revision');
  }
  if (!changesSummary || !changesSummary.trim()) {
    throw new Error('Revision changesSummary is required');
  }

  const byteLength =
    typeof params.fileSize === 'number'
      ? params.fileSize
      : fileBytes instanceof Uint8Array
        ? fileBytes.byteLength
        : fileBytes instanceof ArrayBuffer
          ? fileBytes.byteLength
          : typeof (fileBytes as Blob)?.size === 'number'
            ? (fileBytes as Blob).size
            : 0;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const attemptUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const operationId = params.operationId || attemptUuid;
  const storageBucket = 'matter-documents';
  const storagePath = `${workspaceId}/${matterId}/${documentId}_${attemptUuid}_${safeName}`;

  // 1. Upload new version bytes to private storage at a unique attempt path
  const { data: storageData, error: storageErr } = await client.storage
    .from(storageBucket)
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (storageErr || !storageData?.path) {
    throw new Error(
      `Private storage revision upload failed: ${storageErr?.message || 'No path returned'}`
    );
  }

  // 2. Commit version metadata and document current_version pointer in one atomic DB transaction under lock
  const { data: rpcRes, error: rpcErr } = await client.rpc('commit_document_revision_atomic', {
    p_workspace_id: workspaceId,
    p_matter_id: matterId,
    p_document_id: documentId,
    p_file_path: storagePath,
    p_file_size: byteLength,
    p_mime_type: mimeType,
    p_changes_summary: changesSummary.trim(),
    p_extracted_text: extractedText,
    p_author_name: authorName,
    p_expected_version: params.expectedVersion !== undefined && params.expectedVersion !== null ? Number(params.expectedVersion) : null,
    p_operation_id: operationId,
  });

  if (rpcErr || !rpcRes) {
    // Track uncommitted upload for safe cleanup without deleting historical committed bytes
    let cleanupNotice = '';
    try {
      const { error: remErr } = await client.storage.from(storageBucket).remove([storagePath]);
      if (remErr) {
        cleanupNotice = ` (Storage cleanup error: ${remErr.message})`;
      }
    } catch (cleanupErr: any) {
      cleanupNotice = ` (Storage cleanup error: ${cleanupErr?.message || 'Failed to remove orphaned storage object'})`;
    }
    throw new Error(`Document revision commit failed: ${rpcErr?.message || 'No payload'}${cleanupNotice}`);
  }

  // Fetch all version records for constructing EnterpriseDoc
  const { data: verRows } = await client
    .from('document_versions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('document_id', documentId)
    .order('version', { ascending: false });

  return mapDocumentRowToEnterpriseDoc(rpcRes.document, verRows || [rpcRes.version]);
}

/**
 * Downloads original file bytes from private Supabase Storage (`matter-documents`)
 */
export async function downloadDocumentFromStorage(
  storageBucket: string = 'matter-documents',
  filePath: string,
  client: SupabaseClient = supabase
): Promise<{ blob: Blob; bytes: Uint8Array; size: number }> {
  if (!filePath) {
    throw new Error('filePath is required to download document from private storage');
  }

  const { data, error } = await client.storage.from(storageBucket).download(filePath);
  if (error || !data) {
    throw new Error(error?.message || 'Failed to download document from private storage');
  }

  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  return {
    blob: data,
    bytes,
    size: bytes.byteLength,
  };
}

// ============================================================================
// EVIDENCE PERSISTENCE (`public.evidence`)
// ============================================================================

export function mapEvidenceRowToItem(row: any): EvidenceItem {
  return {
    id: row.id,
    caseId: row.matter_id,
    title: row.title,
    type: (row.type as EvidenceItem['type']) || 'Document',
    submittedBy: row.submitted_by || 'Advocate',
    provesWhat: row.proves_what || row.summary || '',
    cannotProve: row.cannot_prove || '',
    date: row.evidence_date
      ? String(row.evidence_date).split('T')[0]
      : row.created_at
        ? String(row.created_at).split('T')[0]
        : '',
    status:
      row.verification_status === 'Verified'
        ? 'Verified'
        : row.verification_status === 'Disputed' || row.verification_status === 'Challenged'
          ? 'Challenged'
          : 'Unverified',
  };
}

export async function listEvidenceForMatter(
  workspaceId: string,
  matterId: string,
  client: SupabaseClient = supabase
): Promise<EvidenceItem[]> {
  if (!workspaceId || !matterId) return [];
  const { data, error } = await client
    .from('evidence')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('matter_id', matterId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load evidence: ${error.message}`);
  }
  return (data || []).map(mapEvidenceRowToItem);
}

export async function createEvidenceInDb(
  workspaceId: string,
  matterId: string,
  item: Omit<EvidenceItem, 'id'> & { id?: string; sourceDocId?: string | null },
  client: SupabaseClient = supabase
): Promise<EvidenceItem> {
  if (!workspaceId || !matterId) {
    throw new Error('workspaceId and matterId are required to create evidence');
  }
  if (!item.title || !item.title.trim()) {
    throw new Error('Evidence title is required');
  }

  const verificationStatus =
    item.status === 'Verified'
      ? 'Verified'
      : item.status === 'Challenged' || item.status === 'Contradictory'
        ? 'Disputed'
        : 'Unverified';

  const { data, error } = await client
    .from('evidence')
    .insert({
      workspace_id: workspaceId,
      matter_id: matterId,
      title: item.title.trim(),
      type: item.type || 'Document',
      source_doc_id: item.sourceDocId || null,
      submitted_by: item.submittedBy || 'Advocate',
      summary: item.provesWhat || '',
      proves_what: item.provesWhat || '',
      cannot_prove: item.cannotProve || '',
      evidence_date: item.date || new Date().toISOString().split('T')[0],
      verification_status: verificationStatus,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save evidence item in PostgreSQL');
  }

  return mapEvidenceRowToItem(data);
}

// ============================================================================
// TIMELINE EVENTS PERSISTENCE (`public.timeline_events`)
// ============================================================================

export function mapTimelineRowToNode(row: any): TimelineNode {
  return {
    id: row.id,
    date: row.event_date ? String(row.event_date).split('T')[0] : '',
    event: row.event_title,
    category: (row.category as TimelineNode['category']) || 'Property',
    flag: row.flag || undefined,
  };
}

export async function listTimelineEventsForMatter(
  workspaceId: string,
  matterId: string,
  client: SupabaseClient = supabase
): Promise<TimelineNode[]> {
  if (!workspaceId || !matterId) return [];
  const { data, error } = await client
    .from('timeline_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('matter_id', matterId)
    .order('event_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load timeline events: ${error.message}`);
  }
  return (data || []).map(mapTimelineRowToNode);
}

export async function createTimelineEventInDb(
  workspaceId: string,
  matterId: string,
  node: {
    date: string;
    event: string;
    category?: TimelineNode['category'];
    flag?: string;
    sourceFindingId?: string | null;
  },
  client: SupabaseClient = supabase
): Promise<TimelineNode> {
  if (!workspaceId || !matterId) {
    throw new Error('workspaceId and matterId are required to create a timeline event');
  }
  if (!node.date || !node.event || !node.event.trim()) {
    throw new Error('Timeline event date and description are required');
  }

  const { data, error } = await client
    .from('timeline_events')
    .insert({
      workspace_id: workspaceId,
      matter_id: matterId,
      event_date: node.date,
      event_title: node.event.trim(),
      category: node.category || 'Property',
      flag: node.flag || null,
      source_finding_id: node.sourceFindingId || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save timeline event in PostgreSQL');
  }

  return mapTimelineRowToNode(data);
}

// ============================================================================
// BILLING PERSISTENCE (`public.time_entries`, `public.invoices`, `public.payments`)
// ============================================================================

export function mapTimeEntryRowToTimeLog(row: any, cases: CaseFile[] = []): TimeLog {
  const matchedCase = cases.find((c) => c.id === row.matter_id);
  return {
    id: row.id,
    caseId: row.matter_id || '',
    caseTitle: matchedCase?.title || 'Legal Matter',
    advocateName: row.advocate_name || 'Advocate',
    advocateRole: row.advocate_role || 'Advocate',
    taskCategory: (row.task_category as TimeLog['taskCategory']) || 'Document Review',
    description: row.description || '',
    hours: Number(row.hours || 0),
    hourlyRate: Number(row.hourly_rate || 0),
    totalAmount: Number(row.total_amount || 0),
    date: row.date ? String(row.date).split('T')[0] : new Date().toISOString().split('T')[0],
    billable: row.billable !== false,
    status: (row.status as TimeLog['status']) || 'Unbilled',
    invoiceId: row.invoice_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function listTimeEntriesForWorkspace(
  workspaceId: string,
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<TimeLog[]> {
  if (!workspaceId) return [];
  const { data, error } = await client
    .from('time_entries')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load time entries: ${error.message}`);
  }
  return (data || []).map((r: any) => mapTimeEntryRowToTimeLog(r, cases));
}

export async function createTimeEntryInDb(
  workspaceId: string,
  log: Omit<TimeLog, 'id' | 'createdAt'>,
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<TimeLog> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to create a time entry');
  }
  if (!log.description || !log.description.trim()) {
    throw new Error('Time entry description is required');
  }

  const isUuid = (val?: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const { data, error } = await client
    .from('time_entries')
    .insert({
      workspace_id: workspaceId,
      matter_id: isUuid(log.caseId) ? log.caseId : null,
      advocate_name: log.advocateName || 'Advocate',
      advocate_role: log.advocateRole || 'Advocate',
      task_category: log.taskCategory || 'Document Review',
      description: log.description.trim(),
      hours: Number(log.hours || 0),
      hourly_rate: Number(log.hourlyRate || 0),
      total_amount: Number(log.totalAmount || 0),
      date: log.date || new Date().toISOString().split('T')[0],
      billable: log.billable !== false,
      status: log.status || 'Unbilled',
      invoice_id: isUuid(log.invoiceId) ? log.invoiceId : null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create time entry in PostgreSQL');
  }

  return mapTimeEntryRowToTimeLog(data, cases);
}

export async function deleteTimeEntryInDb(
  workspaceId: string,
  timeEntryId: string,
  client: SupabaseClient = supabase
): Promise<void> {
  if (!workspaceId || !timeEntryId) {
    throw new Error('workspaceId and timeEntryId are required');
  }
  const { error } = await client
    .from('time_entries')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', timeEntryId);

  if (error) {
    throw new Error(`Failed to delete time entry: ${error.message}`);
  }
}

export function mapInvoiceRowToInvoice(
  row: any,
  paymentRows: any[] = [],
  cases: CaseFile[] = []
): Invoice {
  const matchedCase = cases.find((c) => c.id === row.matter_id);
  const subtotal = Number(row.subtotal || 0);
  const taxAmount = Number(row.tax_amount || 0);
  const discountAmount = Number(row.discount_amount || 0);
  const totalAmount = Number(row.total_amount || 0);
  const paidAmount = Number(row.paid_amount || 0);
  const balanceAmount =
    row.balance_amount !== null && row.balance_amount !== undefined
      ? Number(row.balance_amount)
      : Math.max(0, totalAmount - paidAmount);

  const mappedPayments: InvoicePayment[] = paymentRows.map((p: any) => ({
    id: p.id,
    invoiceId: p.invoice_id,
    amount: Number(p.amount || 0),
    paymentDate: p.payment_date ? String(p.payment_date).split('T')[0] : '',
    paymentMethod: (p.payment_method as InvoicePayment['paymentMethod']) || 'UPI',
    referenceNo: p.reference_no || '',
    notes: p.notes || undefined,
  }));

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    caseId: row.matter_id || '',
    caseTitle: matchedCase?.title || 'Legal Matter',
    clientName: row.client_name,
    clientEmail: row.client_email || matchedCase?.clientEmail || '',
    clientPhone: row.client_phone || matchedCase?.clientPhone || '',
    clientAddress: row.client_address || '',
    issueDate: row.issue_date ? String(row.issue_date).split('T')[0] : '',
    dueDate: row.due_date ? String(row.due_date).split('T')[0] : '',
    hourlyRate: 3500,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal,
    taxRatePercentage: Number(row.tax_rate_percentage ?? 18),
    taxAmount,
    discountAmount,
    totalAmount,
    paidAmount,
    balanceAmount,
    status: (row.status as Invoice['status']) || 'Issued',
    paymentTerms: row.payment_terms || '',
    notes: row.notes || '',
    bankDetails:
      row.bank_details && typeof row.bank_details === 'object' ? row.bank_details : undefined,
    payments: mappedPayments,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export async function listInvoicesForWorkspace(
  workspaceId: string,
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<Invoice[]> {
  if (!workspaceId) return [];
  const { data: invRows, error: invErr } = await client
    .from('invoices')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (invErr) {
    throw new Error(`Failed to load invoices: ${invErr.message}`);
  }
  if (!invRows || invRows.length === 0) return [];

  const { data: payRows, error: payErr } = await client
    .from('payments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('payment_date', { ascending: true });

  if (payErr) {
    throw new Error(`Failed to load invoice payments: ${payErr.message}`);
  }

  const paymentsByInvoice = new Map<string, any[]>();
  for (const p of payRows || []) {
    const list = paymentsByInvoice.get(p.invoice_id) || [];
    list.push(p);
    paymentsByInvoice.set(p.invoice_id, list);
  }

  return invRows.map((row: any) =>
    mapInvoiceRowToInvoice(row, paymentsByInvoice.get(row.id) || [], cases)
  );
}

export async function createInvoiceInDb(
  workspaceId: string,
  invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
  linkedTimeLogIds: string[] = [],
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<Invoice> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to create an invoice');
  }
  if (!invoice.clientName || !invoice.clientName.trim()) {
    throw new Error('Invoice clientName is required');
  }

  const isUuid = (val?: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const { data: createdInv, error: invErr } = await client
    .from('invoices')
    .insert({
      workspace_id: workspaceId,
      matter_id: isUuid(invoice.caseId) ? invoice.caseId : null,
      invoice_number: invoice.invoiceNumber,
      client_name: invoice.clientName.trim(),
      client_email: invoice.clientEmail || null,
      client_phone: invoice.clientPhone || null,
      client_address: invoice.clientAddress || null,
      issue_date: invoice.issueDate || new Date().toISOString().split('T')[0],
      due_date: invoice.dueDate || null,
      subtotal: Number(invoice.subtotal || 0),
      tax_rate_percentage: Number(invoice.taxRatePercentage ?? 18),
      tax_amount: Number(invoice.taxAmount || 0),
      discount_amount: Number(invoice.discountAmount || 0),
      total_amount: Number(invoice.totalAmount || 0),
      paid_amount: Number(invoice.paidAmount || 0),
      balance_amount: Number(invoice.balanceAmount ?? invoice.totalAmount ?? 0),
      status: invoice.status || 'Issued',
      payment_terms: invoice.paymentTerms || null,
      notes: invoice.notes || null,
      items: invoice.items || [],
      bank_details: invoice.bankDetails || {},
    })
    .select('*')
    .single();

  if (invErr || !createdInv) {
    throw new Error(invErr?.message || 'Failed to create invoice in PostgreSQL');
  }

  const validLogIds = linkedTimeLogIds.filter(isUuid);
  if (validLogIds.length > 0) {
    const { error: linkErr } = await client
      .from('time_entries')
      .update({
        status: 'Invoiced',
        invoice_id: createdInv.id,
      })
      .eq('workspace_id', workspaceId)
      .in('id', validLogIds);

    if (linkErr) {
      throw new Error(`Invoice created, but linking time entries failed: ${linkErr.message}`);
    }
  }

  return mapInvoiceRowToInvoice(createdInv, [], cases);
}

export async function deleteInvoiceInDb(
  workspaceId: string,
  invoiceId: string,
  client: SupabaseClient = supabase
): Promise<void> {
  if (!workspaceId || !invoiceId) {
    throw new Error('workspaceId and invoiceId are required');
  }
  const { error } = await client
    .from('invoices')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', invoiceId);

  if (error) {
    throw new Error(`Failed to delete invoice: ${error.message}`);
  }
}

export async function recordPaymentInDb(
  workspaceId: string,
  invoice: Invoice,
  payment: Omit<InvoicePayment, 'id' | 'invoiceId'> & { idempotencyKey: string },
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<Invoice> {
  if (!workspaceId || !invoice?.id) {
    throw new Error('workspaceId and invoice.id are required to record a payment');
  }

  // Require operation ID explicitly; no fallback to derived strings
  if (!payment.idempotencyKey || !payment.idempotencyKey.trim()) {
    throw new Error('Payment operation ID (idempotency key) is required');
  }
  const idempotencyKey = payment.idempotencyKey.trim();

  const payAmount = Number(payment.amount);
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw new Error('Payment amount must be a finite positive number');
  }

  const payDate = payment.paymentDate || new Date().toISOString().split('T')[0];
  const payMethod = payment.paymentMethod || 'UPI';
  const payRef = payment.referenceNo || null;
  const payNotes = payment.notes || null;

  const { data: updatedInvRow, error } = await client.rpc('record_payment_atomic', {
    p_workspace_id: workspaceId,
    p_invoice_id: invoice.id,
    p_amount: payAmount,
    p_payment_date: payDate,
    p_method: payMethod,
    p_reference_no: payRef,
    p_notes: payNotes,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !updatedInvRow) {
    // On concurrent conflict or collision, inspect existing payment payload
    if (
      error?.message?.includes('Idempotency key collision') ||
      error?.message?.includes('duplicate key') ||
      error?.message?.includes('unique_violation') ||
      error?.code === '23505'
    ) {
      const { data: existingPayments } = await client
        .from('payments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('idempotency_key', idempotencyKey);

      if (existingPayments && existingPayments.length > 0) {
        const existing = existingPayments[0];
        // Compare complete canonical payload (invoice, amount, date, method, reference, notes)
        const isMatch =
          existing.invoice_id === invoice.id &&
          Number(existing.amount) === payAmount &&
          existing.payment_date === payDate &&
          (existing.payment_method || '') === payMethod &&
          (existing.reference_no || null) === payRef &&
          (existing.notes || null) === payNotes;

        if (isMatch) {
          // Exactly matching retry: fetch authoritative invoice state and return success
          const { data: currentInv } = await client
            .from('invoices')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('id', invoice.id)
            .maybeSingle();

          if (currentInv) {
            let retryPayRows: any[] = [];
            try {
              const { data: payRows } = await client
                .from('payments')
                .select('*')
                .eq('workspace_id', workspaceId)
                .eq('invoice_id', invoice.id)
                .order('created_at', { ascending: false });
              if (payRows) retryPayRows = payRows;
            } catch (err: any) {
              console.warn('Payment retry succeeded, but reloading payment history encountered an error:', err?.message);
            }
            return mapInvoiceRowToInvoice(currentInv, retryPayRows, cases);
          }
        } else {
          throw new Error('Idempotency key collision with conflicting payment details');
        }
      }
    }
    throw new Error(error?.message || 'Failed to record payment in PostgreSQL');
  }

  // Surface payment-history reload errors without implying the payment itself failed
  let payRows: any[] = [];
  try {
    const { data: historyData, error: payError } = await client
      .from('payments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: false });

    if (payError) {
      console.warn('Payment recorded successfully, but reloading payment history encountered an error:', payError.message);
    } else if (historyData) {
      payRows = historyData;
    }
  } catch (historyErr: any) {
    console.warn('Payment recorded successfully, but reloading payment history failed:', historyErr?.message);
  }

  return mapInvoiceRowToInvoice(updatedInvRow, payRows, cases);
}

// ============================================================================
// WORKSPACE MEMBERS / ROLE MANAGER PERSISTENCE (`public.workspace_memberships`)
// ============================================================================

export interface WorkspaceMemberRecord {
  id: string;
  userId?: string | null;
  email: string;
  name: string;
  role: ChamberRole;
  status: 'Active' | 'Pending Invitation' | 'Revoked';
  invitedAt: string;
}

export function mapMembershipRowToRecord(row: any): WorkspaceMemberRecord {
  return {
    id: row.id,
    userId: row.user_id || null,
    email: row.member_email || row.email || 'member@chamber.in',
    name: row.member_name || row.name || 'Workspace Member',
    role: (row.role as ChamberRole) || 'JUNIOR_ADVOCATE',
    status: (row.status as WorkspaceMemberRecord['status']) || 'Active',
    invitedAt: row.created_at
      ? String(row.created_at).split('T')[0]
      : new Date().toISOString().split('T')[0],
  };
}

export async function listWorkspaceMembers(
  workspaceId: string,
  client: SupabaseClient = supabase
): Promise<WorkspaceMemberRecord[]> {
  if (!workspaceId) return [];
  const { data, error } = await client
    .from('workspace_memberships')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load workspace members: ${error.message}`);
  }
  return (data || []).map(mapMembershipRowToRecord);
}

export async function inviteWorkspaceMemberInDb(
  workspaceId: string,
  member: {
    email: string;
    name: string;
    role: ChamberRole;
    userId?: string | null;
    invitedByUserId?: string | null;
  },
  client: SupabaseClient = supabase
): Promise<WorkspaceMemberRecord> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to invite a workspace member');
  }
  if (!member.email || !member.email.trim() || !member.name || !member.name.trim()) {
    throw new Error('Member name and email are required');
  }

  const { data, error } = await client
    .from('workspace_memberships')
    .insert({
      workspace_id: workspaceId,
      user_id: member.userId || null,
      member_email: member.email.trim().toLowerCase(),
      member_name: member.name.trim(),
      role: member.role,
      status: member.userId ? 'Active' : 'Pending Invitation',
      invited_by_user_id: member.invitedByUserId || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to invite workspace member in PostgreSQL');
  }

  return mapMembershipRowToRecord(data);
}

export async function updateWorkspaceMemberRoleInDb(
  workspaceId: string,
  membershipId: string,
  updates: { role?: ChamberRole; status?: 'Active' | 'Pending Invitation' | 'Revoked' },
  client: SupabaseClient = supabase
): Promise<WorkspaceMemberRecord> {
  if (!workspaceId || !membershipId) {
    throw new Error('workspaceId and membershipId are required');
  }

  const { data, error } = await client
    .from('workspace_memberships')
    .update({
      ...(updates.role ? { role: updates.role } : {}),
      ...(updates.status ? { status: updates.status } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', membershipId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update workspace member role');
  }

  return mapMembershipRowToRecord(data);
}

// ============================================================================
// REACT HOOKS
// ============================================================================

export function useMatters(chamberId: string, isDemoMode: boolean = false) {
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMatters = useCallback(async () => {
    if (!chamberId || isDemoMode) {
      setCases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loaded = await listMattersForWorkspace(chamberId);
      setCases(loaded);
    } catch (err: any) {
      console.error('[useMatters] Supabase query error:', err);
      setError(err?.message || 'Failed to sync matters from workspace database.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [chamberId, isDemoMode]);

  useEffect(() => {
    refreshMatters();
  }, [refreshMatters]);

  return { cases, loading, error, refreshMatters };
}

export function useMatter(chamberId: string, matterId: string, isDemoMode: boolean = false) {
  const [matter, setMatter] = useState<CaseFile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    if (!chamberId || !matterId || isDemoMode) {
      setMatter(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMatterById(chamberId, matterId)
      .then((found) => {
        if (!cancelled) {
          setMatter(found);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          console.error('[useMatter] Load error:', err);
          setError(err?.message || 'Failed to load matter record.');
          setMatter(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chamberId, matterId, isDemoMode]);

  const saveMatter = async (updatedMatter: CaseFile) => {
    if (!chamberId || !matterId || isDemoMode) return;
    const previousMatter = matter;
    setMatter(updatedMatter);
    setSaveStatus('saving');
    setError(null);
    try {
      const saved = await updateMatterInDb(chamberId, matterId, updatedMatter);
      setMatter(saved);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('[useMatter] Save matter error:', err);
      setMatter(previousMatter);
      setSaveStatus('error');
      setError(err?.message || 'Failed to save matter changes.');
      throw err;
    }
  };

  return { matter, loading, error, saveStatus, saveMatter };
}

export function useMatterTasks(chamberId: string, matterId?: string, isDemoMode: boolean = false) {
  const [tasks, setTasks] = useState<PracticeTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!chamberId || isDemoMode) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loaded = await listTasksForWorkspace(chamberId, matterId);
      setTasks(loaded);
    } catch (err: any) {
      console.error('[useMatterTasks] Supabase error:', err);
      setError(err?.message || 'Failed to sync chamber tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [chamberId, matterId, isDemoMode]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const toggleTask = async (taskId: string) => {
    if (!chamberId || isDemoMode) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const previousTasks = [...tasks];
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)));
    setError(null);

    try {
      const saved = await toggleTaskStatusInDb(chamberId, taskId, task.status);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? saved : t)));
      logAuditEvent('CASE_UPDATE', `Toggled task "${task.title}" status to ${nextStatus}`, {
        chamberId,
        caseId: task.caseId,
      });
    } catch (err: any) {
      console.error('[useMatterTasks] Toggle task error:', err);
      setTasks(previousTasks);
      setError(err?.message || 'Failed to update task status.');
      throw err;
    }
  };

  const addTask = async (newTask: PracticeTask) => {
    if (!chamberId || isDemoMode) return;
    setError(null);
    try {
      const saved = await createTaskInDb(chamberId, {
        ...newTask,
        caseId: newTask.caseId || matterId,
      });
      setTasks((prev) => [saved, ...prev]);
      logAuditEvent('CASE_UPDATE', `Created task "${saved.title}"`, {
        chamberId,
        caseId: saved.caseId,
      });
    } catch (err: any) {
      console.error('[useMatterTasks] Add task error:', err);
      setError(err?.message || 'Failed to create task.');
      throw err;
    }
  };

  return { tasks, loading, error, toggleTask, addTask, refreshTasks: loadTasks };
}

export interface ExtractedFactRecord {
  id: string;
  workspaceId: string;
  matterId: string;
  documentId: string | null;
  sourceVersion: number | null;
  findingText: string;
  editedText: string | null;
  extractionMethod: string;
  status: 'Proposed' | 'Accepted' | 'Rejected';
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export async function saveExtractedFactsToMatter(
  chamberId: string,
  matterId: string,
  data: {
    summary?: string;
    facts?: string[];
    timeline?: Array<{ date: string; event: string }>;
    riskFactors?: string[];
    favourableFactors?: string[];
    evidenceGaps?: string[];
    overallAssessment?: string;
    sourceDocumentId?: string | null;
    sourceVersion?: number | null;
  },
  client: SupabaseClient = supabase
): Promise<void> {
  if (!chamberId || !matterId) return;

  try {
    const existingData = await getMatterById(chamberId, matterId, client);
    if (!existingData) return;

    const existingAssessment = existingData.caseAssessment || {};

    // DO NOT automatically merge proposed facts into favourableFactors! Only explicitly accepted facts enter assessment
    const updatedAssessment: CaseAssessment = {
      ...existingAssessment,
      favourableFactors: Array.from(
        new Set([
          ...(existingAssessment.favourableFactors || []),
          ...(data.favourableFactors || []),
        ])
      ),
      riskFactors: Array.from(
        new Set([...(existingAssessment.riskFactors || []), ...(data.riskFactors || [])])
      ),
      evidenceGaps: Array.from(
        new Set([...(existingAssessment.evidenceGaps || []), ...(data.evidenceGaps || [])])
      ),
      overallAssessment:
        (data.overallAssessment as any) ||
        existingAssessment.overallAssessment ||
        'Mixed / Requires Review',
    };

    const updatePayload: Partial<CaseFile> = {
      caseAssessment: updatedAssessment,
    };

    if (data.summary) {
      updatePayload.summary = data.summary;
    }

    if (data.timeline && data.timeline.length > 0) {
      updatePayload.timeline = Array.from(
        new Set([
          ...(existingData.timeline || []),
          ...data.timeline.map((t) => `${t.date}: ${t.event}`),
        ])
      );
    }

    if (data.facts && data.facts.length > 0) {
      const isUuid = (val?: string | null) =>
        !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      const findingRows = data.facts.map((factText) => ({
        workspace_id: chamberId,
        matter_id: matterId,
        document_id: isUuid(data.sourceDocumentId) ? data.sourceDocumentId : null,
        source_version: data.sourceVersion ? Number(data.sourceVersion) : null,
        finding_text: factText,
        extraction_method: 'AI_EXTRACTED',
        status: 'Proposed', // Saved strictly as Proposed (Req 14)
      }));
      const { error: fndError } = await client.from('findings').insert(findingRows);
      if (fndError) {
        throw new Error(`Failed to save extracted findings: ${fndError.message}`);
      }
    }

    await updateMatterInDb(chamberId, matterId, updatePayload, client);
    logAuditEvent(
      'CASE_UPDATE',
      'Updated matter assessment and extracted facts as Proposed via Document Analyzer',
      { chamberId, caseId: matterId }
    );
  } catch (err) {
    console.error('Error saving extracted facts to matter:', err);
    throw err;
  }
}

export async function listExtractedFactsForMatter(
  workspaceId: string,
  matterId: string,
  client: SupabaseClient = supabase
): Promise<ExtractedFactRecord[]> {
  if (!workspaceId || !matterId) return [];
  const { data, error } = await client
    .from('findings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('matter_id', matterId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load extracted facts: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    matterId: row.matter_id,
    documentId: row.document_id || null,
    sourceVersion: row.source_version ? Number(row.source_version) : null,
    findingText: row.finding_text,
    editedText: row.edited_text || null,
    extractionMethod: row.extraction_method || 'AI_EXTRACTED',
    status: (row.status as ExtractedFactRecord['status']) || 'Proposed',
    reviewedByUserId: row.reviewed_by_user_id || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
  }));
}

export async function reviewExtractedFactInDb(
  workspaceId: string,
  findingId: string,
  action: 'Accept' | 'Reject' | 'Edit',
  editedText?: string,
  client: SupabaseClient = supabase
): Promise<ExtractedFactRecord> {
  if (!workspaceId || !findingId) {
    throw new Error('workspaceId and findingId are required for review action');
  }

  const { data, error } = await client.rpc('review_extracted_fact_atomic', {
    p_workspace_id: workspaceId,
    p_finding_id: findingId,
    p_action: action,
    p_edited_text: editedText || null,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to review extracted fact in PostgreSQL');
  }

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    matterId: data.matter_id,
    documentId: data.document_id || null,
    sourceVersion: data.source_version ? Number(data.source_version) : null,
    findingText: data.finding_text,
    editedText: data.edited_text || null,
    extractionMethod: data.extraction_method || 'AI_EXTRACTED',
    status: (data.status as ExtractedFactRecord['status']) || 'Proposed',
    reviewedByUserId: data.reviewed_by_user_id || null,
    reviewedAt: data.reviewed_at || null,
    createdAt: data.created_at,
  };
}

export async function getAcceptedFactsForMatterInDb(
  workspaceId: string,
  matterId: string,
  client: SupabaseClient = supabase
): Promise<ExtractedFactRecord[]> {
  if (!workspaceId || !matterId) return [];
  const allFacts = await listExtractedFactsForMatter(workspaceId, matterId, client);
  return allFacts.filter((f) => f.status === 'Accepted');
}

export interface DraftRecord {
  id: string;
  workspaceId: string;
  matterId: string;
  title: string;
  type: string;
  contentMarkdown: string;
  currentVersion: number;
  approvedVersion: number | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveDraftRevisionInDb(
  workspaceId: string,
  matterId: string,
  draft: {
    id?: string;
    title: string;
    type?: string;
    contentMarkdown: string;
    expectedVersion?: number;
    changeNotes?: string;
    operationId?: string;
  },
  client: SupabaseClient = supabase
): Promise<DraftRecord> {
  if (!workspaceId || !matterId) {
    throw new Error('workspaceId and matterId are required to save draft');
  }
  if (!draft.title || !draft.title.trim()) {
    throw new Error('Draft title is required');
  }

  const isUuid = (val?: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const { data, error } = await client.rpc('save_draft_revision_atomic', {
    p_workspace_id: workspaceId,
    p_matter_id: matterId,
    p_draft_id: isUuid(draft.id) ? draft.id : null,
    p_title: draft.title.trim(),
    p_doc_type: draft.type || 'Pleading',
    p_content: draft.contentMarkdown || '',
    p_expected_version:
      draft.expectedVersion !== undefined && draft.expectedVersion !== null
        ? Number(draft.expectedVersion)
        : null,
    p_change_notes: draft.changeNotes || null,
    p_operation_id: draft.operationId || null,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save draft revision in PostgreSQL');
  }

  logAuditEvent(
    'DOCUMENT_UPLOAD',
    `Saved revision v${data.current_version} of draft "${data.title}" to Matter Document Vault`,
    { chamberId: workspaceId, caseId: matterId, docId: data.id }
  );

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    matterId: data.matter_id,
    title: data.title,
    type: data.doc_type || 'Pleading',
    contentMarkdown: data.content || '',
    currentVersion: Number(data.current_version || 1),
    approvedVersion: data.approved_version ? Number(data.approved_version) : null,
    approvedByUserId: data.approved_by_user_id || null,
    approvedAt: data.approved_at || null,
    status: data.status || 'Draft',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function saveDraftToMatterVault(
  chamberId: string,
  matterId: string,
  draft: {
    id?: string;
    title: string;
    type: string;
    contentMarkdown: string;
    expectedVersion?: number;
    operationId?: string;
  },
  client: SupabaseClient = supabase
): Promise<DraftRecord> {
  return saveDraftRevisionInDb(chamberId, matterId, draft, client);
}

export async function getLatestDraftForMatterInDb(
  workspaceId: string,
  matterId: string,
  client: SupabaseClient = supabase
): Promise<DraftRecord | null> {
  if (!workspaceId || !matterId) return null;
  const { data, error } = await client
    .from('drafts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('matter_id', matterId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    matterId: data.matter_id,
    title: data.title,
    type: data.doc_type || 'Pleading',
    contentMarkdown: data.content || '',
    currentVersion: Number(data.current_version || 1),
    approvedVersion: data.approved_version ? Number(data.approved_version) : null,
    approvedByUserId: data.approved_by_user_id || null,
    approvedAt: data.approved_at || null,
    status: data.status || 'Draft',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listDraftsForMatterInDb(
  workspaceId: string,
  matterId: string,
  client: SupabaseClient = supabase
): Promise<DraftRecord[]> {
  if (!workspaceId || !matterId) return [];
  const { data, error } = await client
    .from('drafts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('matter_id', matterId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load drafts: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    matterId: row.matter_id,
    title: row.title,
    type: row.doc_type || 'Pleading',
    contentMarkdown: row.content || '',
    currentVersion: Number(row.current_version || 1),
    approvedVersion: row.approved_version ? Number(row.approved_version) : null,
    approvedByUserId: row.approved_by_user_id || null,
    approvedAt: row.approved_at || null,
    status: row.status || 'Draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getDraftByIdInDb(
  workspaceId: string,
  draftId: string,
  client: SupabaseClient = supabase
): Promise<DraftRecord | null> {
  if (!workspaceId || !draftId) return null;
  const { data, error } = await client
    .from('drafts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', draftId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    matterId: data.matter_id,
    title: data.title,
    type: data.doc_type || 'Pleading',
    contentMarkdown: data.content || '',
    currentVersion: Number(data.current_version || 1),
    approvedVersion: data.approved_version ? Number(data.approved_version) : null,
    approvedByUserId: data.approved_by_user_id || null,
    approvedAt: data.approved_at || null,
    status: data.status || 'Draft',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getDraftVersionsInDb(
  workspaceId: string,
  draftId: string,
  client: SupabaseClient = supabase
): Promise<
  Array<{
    id: string;
    version: number;
    content: string;
    changeNotes?: string;
    createdAt: string;
  }>
> {
  if (!workspaceId || !draftId) return [];
  const { data, error } = await client
    .from('draft_versions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('draft_id', draftId)
    .order('version', { ascending: true });

  if (error) {
    throw new Error(`Failed to load draft versions: ${error.message}`);
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    version: Number(row.version),
    content: row.content || '',
    changeNotes: row.change_notes || undefined,
    createdAt: row.created_at,
  }));
}

export async function approveDraftInDb(
  workspaceId: string,
  draftId: string,
  version: number,
  userId?: string,
  client: SupabaseClient = supabase
): Promise<DraftRecord> {
  if (!workspaceId || !draftId) {
    throw new Error('workspaceId and draftId are required to approve draft');
  }

  const { data, error } = await client.rpc('approve_draft_atomic', {
    p_workspace_id: workspaceId,
    p_draft_id: draftId,
    p_expected_version: version,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to approve draft in PostgreSQL');
  }

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    matterId: data.matter_id,
    title: data.title,
    type: data.doc_type || 'Pleading',
    contentMarkdown: data.content || '',
    currentVersion: Number(data.current_version || 1),
    approvedVersion: data.approved_version ? Number(data.approved_version) : null,
    approvedByUserId: data.approved_by_user_id || null,
    approvedAt: data.approved_at || null,
    status: data.status || 'Draft',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateDraftInDb(
  workspaceId: string,
  draftId: string,
  updates: { content?: string; title?: string; docType?: string },
  client: SupabaseClient = supabase
): Promise<void> {
  if (!workspaceId || !draftId) {
    throw new Error('workspaceId and draftId are required to update draft');
  }

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.content !== undefined) payload.content = updates.content;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.docType !== undefined) payload.doc_type = updates.docType;

  const { error } = await client
    .from('drafts')
    .update(payload)
    .eq('workspace_id', workspaceId)
    .eq('id', draftId);

  if (error) {
    throw new Error(`Failed to update draft in PostgreSQL: ${error.message}`);
  }
}

// Durable Background AI Jobs
export async function createAiJobInDb(
  workspaceId: string,
  matterId: string | null,
  operation: string,
  inputData: any = {},
  client: SupabaseClient = supabase
): Promise<string> {
  const { data, error } = await client
    .from('ai_jobs')
    .insert({
      workspace_id: workspaceId,
      matter_id: matterId,
      operation,
      input_data: inputData,
      status: 'Queued',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to persist AI job');
  }
  return data.id;
}

export async function updateAiJobStatusInDb(
  workspaceId: string,
  jobId: string,
  status: 'Queued' | 'Running' | 'Completed' | 'Failed',
  errorMessage?: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client
    .from('ai_jobs')
    .update({
      status,
      error_message: errorMessage || null,
      completed_at: status === 'Completed' || status === 'Failed' ? new Date().toISOString() : null,
    })
    .eq('workspace_id', workspaceId)
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update AI job status: ${error.message}`);
  }
}

export async function saveAiResultInDb(
  workspaceId: string,
  jobId: string,
  resultType: string,
  resultData: any,
  client: SupabaseClient = supabase
): Promise<string> {
  const { data, error } = await client
    .from('ai_results')
    .insert({
      workspace_id: workspaceId,
      job_id: jobId,
      result_type: resultType,
      result_data: resultData,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to persist AI result');
  }
  return data.id;
}

export async function assignQuickNoteToMatter(
  chamberId: string,
  matterId: string,
  noteTitle: string,
  noteContent: string
): Promise<void> {
  if (!chamberId || !matterId) return;

  try {
    const existingData = await getMatterById(chamberId, matterId);
    if (!existingData) return;

    const noteEntry = `\n\n[Quick Note: ${noteTitle} - ${new Date().toLocaleDateString()}]\n${noteContent}`;
    const newSummary = (existingData.summary || '') + noteEntry;

    await updateMatterInDb(chamberId, matterId, { summary: newSummary });
    logAuditEvent('CASE_UPDATE', `Assigned quick note "${noteTitle}" to matter`, {
      chamberId,
      caseId: matterId,
    });
  } catch (err) {
    console.error('Error assigning quick note to matter:', err);
    throw err;
  }
}

export function useMatterDocuments(
  chamberId: string,
  matterId?: string,
  isDemoMode: boolean = false
) {
  const [documents, setDocuments] = useState<EnterpriseDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!chamberId || isDemoMode) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loaded = await listDocumentsWithVersions(chamberId, matterId);
      setDocuments(loaded);
    } catch (err: any) {
      console.error('[useMatterDocuments] Supabase error:', err);
      setError(err?.message || 'Failed to sync matter documents.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [chamberId, matterId, isDemoMode]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const addDocument = async (docData: {
    name: string;
    fileBytes?: Uint8Array | ArrayBuffer | Blob;
    fileSize?: number;
    mimeType?: string;
    type?: string;
    changesSummary?: string;
    extractedText?: string | null;
    caseId?: string;
    matter_id?: string;
  }) => {
    if (!chamberId || isDemoMode) return null;
    const targetMatterId = matterId || docData.caseId || docData.matter_id;
    if (!targetMatterId) {
      throw new Error('matterId is required to upload a document');
    }

    setError(null);
    try {
      const rawBytes =
        docData.fileBytes || new TextEncoder().encode(docData.extractedText || '');
      const created = await uploadDocumentToStorageAndDb({
        workspaceId: chamberId,
        matterId: targetMatterId,
        fileName: docData.name,
        fileBytes: rawBytes,
        fileSize: docData.fileSize,
        mimeType: docData.mimeType || 'application/octet-stream',
        docType: docData.type || 'Document',
        changesSummary: docData.changesSummary || 'Initial upload',
        extractedText: docData.extractedText ?? null,
      });
      await loadDocuments();
      logAuditEvent('DOCUMENT_UPLOAD', `Uploaded document "${created.name}"`, {
        chamberId,
        caseId: targetMatterId,
        docId: created.id,
      });
      return created;
    } catch (err: any) {
      console.error('[useMatterDocuments] Add doc error:', err);
      setError(err?.message || 'Failed to upload document.');
      throw err;
    }
  };

  return { documents, loading, error, addDocument, refreshDocuments: loadDocuments };
}

export function useMatterEvidence(
  chamberId: string,
  matterId: string,
  isDemoMode: boolean = false
) {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvidence = useCallback(async () => {
    if (!chamberId || !matterId || isDemoMode) {
      setEvidenceList([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loaded = await listEvidenceForMatter(chamberId, matterId);
      setEvidenceList(loaded);
    } catch (err: any) {
      console.error('[useMatterEvidence] Load error:', err);
      setError(err?.message || 'Failed to load evidence records.');
      setEvidenceList([]);
    } finally {
      setLoading(false);
    }
  }, [chamberId, matterId, isDemoMode]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const addEvidenceItem = async (item: Omit<EvidenceItem, 'id'> & { id?: string }) => {
    if (!chamberId || !matterId || isDemoMode) {
      throw new Error('Cannot save evidence without an active workspace and matter');
    }
    setError(null);
    try {
      const created = await createEvidenceInDb(chamberId, matterId, item);
      setEvidenceList((prev) => [created, ...prev]);
      logAuditEvent('CASE_UPDATE', `Added evidence item "${created.title}"`, {
        chamberId,
        caseId: matterId,
      });
      return created;
    } catch (err: any) {
      console.error('[useMatterEvidence] Save error:', err);
      setError(err?.message || 'Failed to save evidence item.');
      throw err;
    }
  };

  return { evidenceList, loading, error, addEvidenceItem, refreshEvidence: loadEvidence };
}

export function useChamberClients(chamberId: string, isDemoMode: boolean = false) {
  const [clients, setClients] = useState<
    Array<{ id: string; name: string; email?: string; phone?: string; mattersCount: number }>
  >([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!chamberId || isDemoMode) {
      setClients([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listMattersForWorkspace(chamberId)
      .then((matters) => {
        if (cancelled) return;
        const clientMap = new Map<
          string,
          { id: string; name: string; email?: string; phone?: string; mattersCount: number }
        >();
        for (const m of matters) {
          if (m.clientName) {
            const key = m.clientName.toLowerCase();
            const existing = clientMap.get(key);
            if (existing) {
              existing.mattersCount += 1;
              if (m.clientEmail) existing.email = m.clientEmail;
              if (m.clientPhone) existing.phone = m.clientPhone;
            } else {
              clientMap.set(key, {
                id: `client-${m.id}`,
                name: m.clientName,
                email: m.clientEmail,
                phone: m.clientPhone,
                mattersCount: 1,
              });
            }
          }
        }
        setClients(Array.from(clientMap.values()));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setClients([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chamberId, isDemoMode]);

  return { clients, loading };
}

// ============================================================================
// CLIENT PORTAL INVITATIONS & RESTRICTED ACCESS GRANTS
// ============================================================================

export interface ClientInvitationScopes {
  viewHearings: boolean;
  viewFilings: boolean;
  viewBilling: boolean;
  uploadDocs: boolean;
  chatAi: boolean;
}

export interface PersistedClientInvitation {
  id: string;
  workspaceId: string;
  matterId: string;
  matterTitle?: string;
  clientEmail: string;
  clientName: string;
  clientPhone?: string | null;
  scopes: ClientInvitationScopes;
  expiresAt: string;
  createdByUserId?: string | null;
  redeemedByUserId?: string | null;
  redeemedAt?: string | null;
  revokedByUserId?: string | null;
  revokedAt?: string | null;
  status: 'Active' | 'Redeemed' | 'Expired' | 'Revoked';
  deliveryStatus: 'email_not_sent' | 'email_sent';
  createdAt: string;
  /**
   * Transiently populated ONLY in memory at the moment of invitation creation
   * so staff can copy the link when email is not configured. Never stored in DB or logged.
   */
  transientInviteUrl?: string;
}

export interface RedeemedClientAccessGrant {
  grantId: string;
  invitationId?: string | null;
  workspaceId: string;
  workspaceName: string;
  matterId: string;
  matterTitle: string;
  clientUserId: string;
  clientEmail: string;
  clientName: string;
  scopes: ClientInvitationScopes;
  expiresAt?: string | null;
  status: 'Redeemed';
  replayed: boolean;
}

export interface RestrictedClientPortalMatterView {
  grant: {
    id: string;
    workspace_id: string;
    workspace_name: string;
    matter_id: string;
    client_email: string;
    client_name: string;
    scopes: ClientInvitationScopes;
    granted_at: string;
    expires_at?: string | null;
  };
  matter: {
    id: string;
    workspace_id: string;
    title: string;
    case_number?: string | null;
    court_name?: string | null;
    judge_name?: string | null;
    stage?: string | null;
    status?: string | null;
    case_type?: string | null;
    client_name?: string | null;
    next_hearing_date?: string | null;
    updated_at?: string | null;
  };
  hearings: Array<{
    id: string;
    hearing_date: string;
    purpose?: string | null;
    court_room?: string | null;
    outcome_notes?: string | null;
    next_date?: string | null;
  }>;
  timeline: Array<{
    id: string;
    event_date: string;
    title: string;
    description?: string | null;
    event_type?: string | null;
  }>;
  documents: Array<{
    id: string;
    name: string;
    doc_type?: string | null;
    file_size?: number | null;
    mime_type?: string | null;
    current_version?: number | null;
    created_at?: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    issue_date: string;
    due_date?: string | null;
    subtotal?: number | null;
    tax_amount?: number | null;
    total_amount: number;
    paid_amount: number;
    balance_amount?: number | null;
    status: string;
  }>;
}

/**
 * Generates a 256-bit (64 hex chars) cryptographically secure invitation token using Web Crypto API.
 * Never uses Math.random().
 */
export function generateSecureClientInviteToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Cryptographically secure random generator is unavailable in this environment.');
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes the SHA-256 hex digest (64 lowercase hex characters) of a raw invitation token.
 * Raw tokens are never stored or logged.
 */
export async function hashClientInviteTokenSha256(rawToken: string): Promise<string> {
  const clean = (rawToken || '').trim();
  if (!clean) {
    throw new Error('Cannot hash an empty invitation token.');
  }
  const encoded = new TextEncoder().encode(clean);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Resolves the configured application origin for building invitation links.
 * Never uses hardcoded fake domains.
 */
export function getConfiguredApplicationOrigin(customOrigin?: string): string {
  if (customOrigin && customOrigin.trim().startsWith('http')) {
    return customOrigin.trim().replace(/\/+$/, '');
  }
  const envOrigin =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_ORIGIN) ||
    (typeof process !== 'undefined' && (process.env?.APP_ORIGIN || process.env?.VITE_APP_ORIGIN));
  if (envOrigin && typeof envOrigin === 'string' && envOrigin.trim().startsWith('http')) {
    return envOrigin.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Builds the client portal redemption link using the configured application origin.
 */
export function buildClientInvitationUrl(rawToken: string, customOrigin?: string): string {
  const origin = getConfiguredApplicationOrigin(customOrigin);
  return `${origin}/portal/redeem?token=${encodeURIComponent(rawToken.trim())}`;
}

export function mapClientInvitationRow(
  row: any,
  cases: CaseFile[] = []
): PersistedClientInvitation {
  const matchedCase = cases.find((c) => c.id === row.matter_id);
  const expiresAtIso = row.expires_at || new Date(Date.now() + 7 * 86400000).toISOString();
  const isPastExpiry = new Date(expiresAtIso).getTime() <= Date.now();
  let computedStatus: PersistedClientInvitation['status'] = row.status || 'Active';
  if (row.revoked_at || computedStatus === 'Revoked') {
    computedStatus = 'Revoked';
  } else if (row.redeemed_at || computedStatus === 'Redeemed') {
    computedStatus = 'Redeemed';
  } else if (isPastExpiry || computedStatus === 'Expired') {
    computedStatus = 'Expired';
  }

  const rawScopes = row.scopes && typeof row.scopes === 'object' ? row.scopes : {};

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    matterId: row.matter_id,
    matterTitle: row.matter_title || matchedCase?.title || 'Matter',
    clientEmail: String(row.client_email || '').toLowerCase(),
    clientName: row.client_name || matchedCase?.clientName || 'Client',
    clientPhone: row.client_phone || null,
    scopes: {
      viewHearings: Boolean(rawScopes.viewHearings ?? true),
      viewFilings: Boolean(rawScopes.viewFilings ?? true),
      viewBilling: Boolean(rawScopes.viewBilling ?? true),
      uploadDocs: Boolean(rawScopes.uploadDocs ?? false),
      chatAi: Boolean(rawScopes.chatAi ?? false),
    },
    expiresAt: expiresAtIso,
    createdByUserId: row.created_by_user_id || null,
    redeemedByUserId: row.redeemed_by_user_id || null,
    redeemedAt: row.redeemed_at || null,
    revokedByUserId: row.revoked_by_user_id || null,
    revokedAt: row.revoked_at || null,
    status: computedStatus,
    deliveryStatus: row.delivery_status === 'email_sent' ? 'email_sent' : 'email_not_sent',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Creates a persisted client invitation via the atomic RPC `create_client_invitation_atomic`,
 * storing ONLY the SHA-256 token hash in PostgreSQL and never logging raw tokens.
 */
export async function createClientInvitationInDb(
  input: {
    workspaceId: string;
    matterId: string;
    clientEmail: string;
    clientName: string;
    clientPhone?: string | null;
    scopes: ClientInvitationScopes;
    expiresInDays?: number;
    expiresAt?: string;
    origin?: string;
  },
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<{
  invitation: PersistedClientInvitation;
  inviteUrl: string;
  emailSent: boolean;
  deliveryStatus: 'email_not_sent' | 'email_sent';
  deliveryMessage: string;
}> {
  if (!input.workspaceId || !input.matterId) {
    throw new Error('Both workspaceId and matterId are required to create a client invitation.');
  }
  const normalizedEmail = (input.clientEmail || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('A valid intended recipient email is required.');
  }

  const rawToken = generateSecureClientInviteToken();
  const tokenHash = await hashClientInviteTokenSha256(rawToken);

  const expiresInDays = Number(input.expiresInDays ?? 7);
  const expiresAtIso = input.expiresAt
    ? new Date(input.expiresAt).toISOString()
    : new Date(Date.now() + Math.max(1, expiresInDays) * 86400000).toISOString();

  const { data, error } = await client.rpc('create_client_invitation_atomic', {
    p_workspace_id: input.workspaceId,
    p_matter_id: input.matterId,
    p_client_email: normalizedEmail,
    p_client_name: (input.clientName || 'Client').trim(),
    p_client_phone: input.clientPhone?.trim() || null,
    p_token_hash: tokenHash,
    p_scopes: input.scopes,
    p_expires_at: expiresAtIso,
    p_delivery_status: 'email_not_sent',
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create client invitation.');
  }

  const inviteUrl = buildClientInvitationUrl(rawToken, input.origin);
  const invitation = mapClientInvitationRow(data, cases);
  invitation.transientInviteUrl = inviteUrl;

  return {
    invitation,
    inviteUrl,
    emailSent: false,
    deliveryStatus: 'email_not_sent',
    deliveryMessage: 'Email not sent',
  };
}

/**
 * Lists persisted client invitations for a workspace (excludes token_hash).
 */
export async function listClientInvitationsForWorkspace(
  workspaceId: string,
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<PersistedClientInvitation[]> {
  if (!workspaceId) return [];

  const { data, error } = await client
    .from('client_invitations')
    .select(
      'id,workspace_id,matter_id,client_email,client_name,client_phone,scopes,expires_at,created_by_user_id,redeemed_by_user_id,redeemed_at,revoked_by_user_id,revoked_at,status,delivery_status,created_at,updated_at'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load client invitations: ${error.message}`);
  }

  return (data || []).map((row) => mapClientInvitationRow(row, cases));
}

/**
 * Atomically revokes a client invitation and any post-redemption client_access_grants.
 */
export async function revokeClientInvitationInDb(
  workspaceId: string,
  invitationId: string,
  client: SupabaseClient = supabase
): Promise<{
  id: string;
  status: 'Revoked';
  revokedAt: string;
  revokedGrantsCount: number;
}> {
  if (!workspaceId || !invitationId) {
    throw new Error('workspaceId and invitationId are required to revoke access.');
  }

  const { data, error } = await client.rpc('revoke_client_invitation_atomic', {
    p_workspace_id: workspaceId,
    p_invitation_id: invitationId,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to revoke client invitation.');
  }

  return {
    id: data.id,
    status: 'Revoked',
    revokedAt: data.revoked_at,
    revokedGrantsCount: Number(data.revoked_grants_count || 0),
  };
}

/**
 * Atomically redeems a raw client invitation token by hashing it with SHA-256 and calling
 * `redeem_client_invitation_atomic`. Never logs raw tokens.
 */
export async function redeemClientInvitationInDb(
  rawToken: string,
  client: SupabaseClient = supabase
): Promise<RedeemedClientAccessGrant> {
  const clean = (rawToken || '').trim();
  if (!clean || clean.length < 32) {
    throw new Error('400 Bad Request: A valid client invitation token is required.');
  }

  const tokenHash = await hashClientInviteTokenSha256(clean);
  const { data, error } = await client.rpc('redeem_client_invitation_atomic', {
    p_token_hash: tokenHash,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to redeem client portal invitation.');
  }

  return {
    grantId: data.grant_id,
    invitationId: data.invitation_id || null,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name || 'Legal Chamber',
    matterId: data.matter_id,
    matterTitle: data.matter_title || 'Matter',
    clientUserId: data.client_user_id,
    clientEmail: data.client_email,
    clientName: data.client_name || 'Client',
    scopes: {
      viewHearings: Boolean(data.scopes?.viewHearings ?? true),
      viewFilings: Boolean(data.scopes?.viewFilings ?? true),
      viewBilling: Boolean(data.scopes?.viewBilling ?? true),
      uploadDocs: Boolean(data.scopes?.uploadDocs ?? false),
      chatAi: Boolean(data.scopes?.chatAi ?? false),
    },
    expiresAt: data.expires_at || null,
    status: 'Redeemed',
    replayed: Boolean(data.replayed),
  };
}

/**
 * Fetches the strictly scoped client portal view for a granted matter.
 * Enforces active non-revoked, non-expired grant and scope permissions.
 */
export async function getRestrictedClientPortalMatterInDb(
  matterId: string,
  client: SupabaseClient = supabase
): Promise<RestrictedClientPortalMatterView> {
  if (!matterId || !matterId.trim()) {
    throw new Error('matterId is required.');
  }

  const { data, error } = await client.rpc('get_restricted_client_portal_matter_atomic', {
    p_matter_id: matterId,
  });

  if (error || !data) {
    throw new Error(
      error?.message || '403 Forbidden: Active client access grant not found or revoked for this matter.'
    );
  }

  return data as RestrictedClientPortalMatterView;
}

/**
 * Lists all active, non-revoked, non-expired client_access_grants for the currently authenticated user.
 */
export async function listActiveClientGrantsForUser(
  client: SupabaseClient = supabase
): Promise<
  Array<{
    id: string;
    workspaceId: string;
    matterId: string;
    clientEmail: string;
    clientName: string;
    scopes: ClientInvitationScopes;
    grantedAt: string;
    expiresAt?: string | null;
  }>
> {
  const { data, error } = await client
    .from('client_access_grants')
    .select('*')
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const now = Date.now();
  return data
    .filter((row: any) => !row.revoked_at && (!row.expires_at || new Date(row.expires_at).getTime() > now))
    .map((row: any) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      matterId: row.matter_id,
      clientEmail: row.client_email || '',
      clientName: row.client_name || 'Client',
      scopes: {
        viewHearings: Boolean(row.scopes?.viewHearings ?? true),
        viewFilings: Boolean(row.scopes?.viewFilings ?? true),
        viewBilling: Boolean(row.scopes?.viewBilling ?? true),
        uploadDocs: Boolean(row.scopes?.uploadDocs ?? false),
        chatAi: Boolean(row.scopes?.chatAi ?? false),
      },
      grantedAt: row.granted_at,
      expiresAt: row.expires_at || null,
    }));
}

// ============================================================================
// HEARINGS PERSISTENCE (`public.hearings`)
// ============================================================================

export function mapHearingRowToCalendarEvent(row: any, cases: CaseFile[] = []): CalendarEvent {
  const matchedMatter = cases.find((c) => c.id === row.matter_id);
  const rawDate = row.hearing_date ? String(row.hearing_date) : new Date().toISOString();
  const datePart = rawDate.split('T')[0];

  let timeLabel = '10:30 AM';
  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime()) && rawDate.includes('T')) {
    const hrs = parsed.getHours();
    const mins = parsed.getMinutes();
    if (!(hrs === 0 && mins === 0)) {
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const hr12 = hrs % 12 || 12;
      timeLabel = `${String(hr12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
    }
  }

  return {
    id: row.id,
    caseId: row.matter_id,
    caseTitle: matchedMatter?.title || 'Legal Matter',
    date: datePart,
    time: timeLabel,
    court: row.court_name || matchedMatter?.courtName || 'Court Not Specified',
    hearingType: row.purpose || 'Hearing',
    judge: row.outcome || undefined,
    status: 'Scheduled',
  };
}

export async function listHearingsForWorkspace(
  workspaceId: string,
  cases: CaseFile[] = [],
  matterId?: string,
  client: SupabaseClient = supabase
): Promise<CalendarEvent[]> {
  if (!workspaceId) return [];
  let query = client.from('hearings').select('*').eq('workspace_id', workspaceId);
  if (matterId) {
    query = query.eq('matter_id', matterId);
  }
  const { data, error } = await query.order('hearing_date', { ascending: true });
  if (error) {
    throw new Error(`Failed to fetch hearings: ${error.message}`);
  }
  return (data || []).map((row: any) => mapHearingRowToCalendarEvent(row, cases));
}

export async function createHearingInDb(
  workspaceId: string,
  hearingInput: {
    matterId: string;
    date: string;
    time?: string;
    courtName?: string;
    purpose: string;
    judgeOrBench?: string;
    notes?: string;
  },
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<CalendarEvent> {
  if (!workspaceId || !hearingInput.matterId) {
    throw new Error('workspaceId and matterId are required to schedule a hearing.');
  }
  if (!hearingInput.date || !hearingInput.purpose?.trim()) {
    throw new Error('Hearing date and purpose/stage are required.');
  }

  let isoTimestamp = `${hearingInput.date}T10:30:00`;
  if (hearingInput.time && /^\d{2}:\d{2}$/.test(hearingInput.time.trim())) {
    isoTimestamp = `${hearingInput.date}T${hearingInput.time.trim()}:00`;
  }

  const { data, error } = await client
    .from('hearings')
    .insert({
      workspace_id: workspaceId,
      matter_id: hearingInput.matterId,
      court_name: hearingInput.courtName?.trim() || null,
      hearing_date: new Date(isoTimestamp).toISOString(),
      purpose: hearingInput.purpose.trim(),
      outcome: hearingInput.judgeOrBench?.trim() || null,
      next_steps: hearingInput.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save hearing in PostgreSQL.');
  }

  // Also sync next_hearing_date on matter record when appropriate
  try {
    await client
      .from('matters')
      .update({
        next_hearing_date: hearingInput.date,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', hearingInput.matterId);
  } catch {
    // Non-fatal if matter next_hearing_date sync fails after hearing row persisted
  }

  return mapHearingRowToCalendarEvent(data, cases);
}



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
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const storageBucket = 'matter-documents';
  const storagePath = `${workspaceId}/${matterId}/${uniquePrefix}_v1_${safeName}`;

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

  const processingStatus =
    extractedText && extractedText.trim().length > 0 ? 'Processed' : 'Uploaded';

  // 2. Insert canonical document metadata row into `public.documents`
  const { data: insertedDoc, error: docErr } = await client
    .from('documents')
    .insert({
      workspace_id: workspaceId,
      matter_id: matterId,
      name: fileName.trim(),
      doc_type: docType,
      storage_bucket: storageBucket,
      file_path: storagePath,
      file_size: byteLength,
      mime_type: mimeType,
      extracted_text: extractedText,
      uploaded_by_user_id: uploadedByUserId,
      processing_status: processingStatus,
      review_status: 'Unreviewed',
      current_version: 1,
    })
    .select('*')
    .single();

  if (docErr || !insertedDoc) {
    // Compensating cleanup of uploaded storage object
    await client.storage.from(storageBucket).remove([storagePath]);
    throw new Error(`Database document insert failed: ${docErr?.message || 'No row returned'}`);
  }

  // 3. Insert immutable v1 record into `public.document_versions`
  const { data: insertedVer, error: verErr } = await client
    .from('document_versions')
    .insert({
      workspace_id: workspaceId,
      document_id: insertedDoc.id,
      version: 1,
      file_path: storagePath,
      file_size: byteLength,
      mime_type: mimeType,
      changes_summary: changesSummary,
      extracted_text: extractedText,
      author_name: authorName,
      created_by_user_id: uploadedByUserId,
    })
    .select('*')
    .single();

  if (verErr || !insertedVer) {
    // Compensating cleanup of document row & storage object
    await client.from('documents').delete().eq('id', insertedDoc.id).eq('workspace_id', workspaceId);
    await client.storage.from(storageBucket).remove([storagePath]);
    throw new Error(
      `Database document_versions insert failed: ${verErr?.message || 'No version row returned'}`
    );
  }

  return mapDocumentRowToEnterpriseDoc(insertedDoc, [insertedVer]);
}

/**
 * Commits a new immutable document version (v2, v3, etc., including rollbacks)
 * by uploading version bytes to private storage, inserting a new row in `public.document_versions`,
 * and updating `public.documents.current_version`.
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

  // Fetch existing versions to determine next integer version
  const { data: existingVersions, error: fetchVerErr } = await client
    .from('document_versions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('document_id', documentId)
    .order('version', { ascending: false });

  if (fetchVerErr) {
    throw new Error(`Failed to fetch existing document versions: ${fetchVerErr.message}`);
  }

  const maxVersion =
    existingVersions && existingVersions.length > 0
      ? Math.max(...existingVersions.map((v: any) => Number(v.version || 1)))
      : 1;
  const nextVersion = maxVersion + 1;

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
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const storageBucket = 'matter-documents';
  const storagePath = `${workspaceId}/${matterId}/${documentId}_${uniquePrefix}_v${nextVersion}_${safeName}`;

  // 1. Upload new version bytes to private storage
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

  // 2. Insert new immutable row in `public.document_versions`
  const { data: newVerRow, error: insVerErr } = await client
    .from('document_versions')
    .insert({
      workspace_id: workspaceId,
      document_id: documentId,
      version: nextVersion,
      file_path: storagePath,
      file_size: byteLength,
      mime_type: mimeType,
      changes_summary: changesSummary.trim(),
      extracted_text: extractedText,
      author_name: authorName,
      created_by_user_id: createdByUserId,
    })
    .select('*')
    .single();

  if (insVerErr || !newVerRow) {
    await client.storage.from(storageBucket).remove([storagePath]);
    throw new Error(
      `Failed to insert new document_versions row: ${insVerErr?.message || 'No version row'}`
    );
  }

  const processingStatus =
    extractedText && extractedText.trim().length > 0 ? 'Processed' : 'Uploaded';

  // 3. Update canonical `public.documents` pointer to latest version
  const { data: updatedDoc, error: updDocErr } = await client
    .from('documents')
    .update({
      current_version: nextVersion,
      file_path: storagePath,
      file_size: byteLength,
      mime_type: mimeType,
      extracted_text: extractedText,
      processing_status: processingStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', documentId)
    .select('*')
    .single();

  if (updDocErr || !updatedDoc) {
    throw new Error(
      `Failed to update document current_version: ${updDocErr?.message || 'No document row'}`
    );
  }

  return mapDocumentRowToEnterpriseDoc(updatedDoc, [newVerRow, ...(existingVersions || [])]);
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
  payment: Omit<InvoicePayment, 'id' | 'invoiceId'> & { idempotencyKey?: string },
  cases: CaseFile[] = [],
  client: SupabaseClient = supabase
): Promise<Invoice> {
  if (!workspaceId || !invoice?.id) {
    throw new Error('workspaceId and invoice.id are required to record a payment');
  }
  const payAmount = Number(payment.amount || 0);
  if (payAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const idempotencyKey =
    payment.idempotencyKey ||
    `pay_${invoice.id}_${payment.paymentDate || 'date'}_${payAmount}_${payment.referenceNo || 'ref'}`;

  const { data: updatedInvRow, error } = await client.rpc('record_payment_atomic', {
    p_workspace_id: workspaceId,
    p_invoice_id: invoice.id,
    p_amount: payAmount,
    p_payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
    p_method: payment.paymentMethod || 'UPI',
    p_reference_no: payment.referenceNo || null,
    p_notes: payment.notes || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !updatedInvRow) {
    throw new Error(error?.message || 'Failed to record payment in PostgreSQL');
  }

  const { data: payRows } = await client
    .from('payments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('invoice_id', invoice.id);

  return mapInvoiceRowToInvoice(updatedInvRow, payRows || [], cases);
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
  }
): Promise<void> {
  if (!chamberId || !matterId) return;

  try {
    const existingData = await getMatterById(chamberId, matterId);
    if (!existingData) return;

    const existingAssessment = existingData.caseAssessment || {};

    const updatedAssessment: CaseAssessment = {
      ...existingAssessment,
      favourableFactors: Array.from(
        new Set([
          ...(existingAssessment.favourableFactors || []),
          ...(data.favourableFactors || []),
          ...(data.facts || []),
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
      const findingRows = data.facts.map((factText) => ({
        workspace_id: chamberId,
        matter_id: matterId,
        finding_text: factText,
        extraction_method: 'AI_EXTRACTED',
        status: 'Proposed',
      }));
      const { error: fndError } = await supabase.from('findings').insert(findingRows);
      if (fndError) {
        throw new Error(`Failed to save extracted findings: ${fndError.message}`);
      }
    }

    await updateMatterInDb(chamberId, matterId, updatePayload);
    logAuditEvent(
      'CASE_UPDATE',
      'Updated matter assessment and extracted facts via Document Analyzer',
      { chamberId, caseId: matterId }
    );
  } catch (err) {
    console.error('Error saving extracted facts to matter:', err);
    throw err;
  }
}

export async function saveDraftToMatterVault(
  chamberId: string,
  matterId: string,
  draft: {
    id?: string;
    title: string;
    type: string;
    contentMarkdown: string;
  }
): Promise<void> {
  if (!chamberId || !matterId) return;

  try {
    const { data: insertedDraft, error } = await supabase
      .from('drafts')
      .insert({
        workspace_id: chamberId,
        matter_id: matterId,
        title: draft.title,
        doc_type: draft.type,
        content: draft.contentMarkdown,
        current_version: 1,
        status: 'Draft',
      })
      .select('id')
      .single();

    if (error || !insertedDraft?.id) {
      throw new Error(error?.message || 'Failed to save draft');
    }

    const { error: versionError } = await supabase.from('draft_versions').insert({
      draft_id: insertedDraft.id,
      workspace_id: chamberId,
      version: 1,
      content: draft.contentMarkdown,
      change_notes: 'Initial AI generated draft',
    });

    if (versionError) {
      await supabase
        .from('drafts')
        .delete()
        .eq('id', insertedDraft.id)
        .eq('workspace_id', chamberId);
      throw new Error(`Failed to save draft version: ${versionError.message}`);
    }

    logAuditEvent(
      'DOCUMENT_UPLOAD',
      `Saved generated draft "${draft.title}" to Matter Document Vault`,
      { chamberId, caseId: matterId, docId: insertedDraft.id }
    );
  } catch (err) {
    console.error('Error saving draft to matter vault:', err);
    throw err;
  }
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

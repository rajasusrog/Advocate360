import { apiGet, apiPost } from './api';

export type JobType = 
  | 'OCR_PROCESSING'
  | 'AI_REASONING_CHAIN'
  | 'VECTOR_EMBEDDING_INDEX'
  | 'LARGE_DOC_ANALYSIS'
  | 'DUPLICATE_CONTRADICTION_CHECK'
  | 'RESEARCH_INDEXING'
  | 'SUMMARIZE_DOCS'
  | 'EXTRACT_FACTS_DATES'
  | 'FIND_CONTRADICTIONS'
  | 'PREPARE_HEARING_BRIEF';

export type JobStatus = 'not_configured' | 'queued' | 'processing' | 'needs_review' | 'completed' | 'failed';

export interface BackgroundJob {
  id: string;
  jobId: string;
  chamberId: string;
  matterId?: string;
  requestedBy: string;
  operation: JobType;
  title: string;
  inputRecordIds?: string[];
  inputVersions?: string[];
  status: JobStatus;
  progress?: number | null;
  timestamps: {
    queuedAt: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
  };
  outputReferences?: string[];
  errorInfo?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  idempotencyKey?: string;
  logs: string[];
}

export interface JobResultResponse {
  jobId: string;
  operation: string;
  resultPayload: any;
}

type JobChangeListener = (jobs: BackgroundJob[]) => void;

class EnterpriseBackgroundJobEngine {
  private jobsMap: Map<string, BackgroundJob> = new Map();
  private listeners: Set<JobChangeListener> = new Set();
  private activeChamberId?: string;
  private activeMatterId?: string;
  private pollTimer: any = null;

  constructor() {
    this.startPolling();
  }

  public subscribe(cb: JobChangeListener): () => void {
    this.listeners.add(cb);
    cb(this.getJobs(this.activeChamberId, this.activeMatterId));
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const list = this.getJobs(this.activeChamberId, this.activeMatterId);
    this.listeners.forEach(cb => cb(list));
  }

  public setActiveScope(chamberId?: string, matterId?: string) {
    this.activeChamberId = chamberId;
    this.activeMatterId = matterId;
    this.refreshJobs().catch(() => {});
  }

  public getJobs(chamberId?: string, matterId?: string): BackgroundJob[] {
    let list = Array.from(this.jobsMap.values());
    if (chamberId) {
      list = list.filter(j => j.chamberId === chamberId);
    }
    if (matterId) {
      list = list.filter(j => j.matterId === matterId);
    }
    return list.sort((a, b) => new Date(b.timestamps.queuedAt).getTime() - new Date(a.timestamps.queuedAt).getTime());
  }

  public async refreshJobs(chamberId?: string, matterId?: string): Promise<BackgroundJob[]> {
    const targetChamberId = chamberId || this.activeChamberId;
    if (!targetChamberId) return this.getJobs();

    try {
      let url = `/api/ai/jobs?chamberId=${encodeURIComponent(targetChamberId)}`;
      const targetMatterId = matterId || this.activeMatterId;
      if (targetMatterId) {
        url += `&matterId=${encodeURIComponent(targetMatterId)}`;
      }

      const fetchedJobs = await apiGet<BackgroundJob[]>(url);
      if (Array.isArray(fetchedJobs)) {
        fetchedJobs.forEach(job => {
          this.jobsMap.set(job.id, job);
        });
        this.notify();
      }
    } catch {
      // Ignore network / auth errors during polling
    }
    return this.getJobs(targetChamberId, matterId);
  }

  public async enqueueJob(params: {
    operation: JobType;
    title: string;
    chamberId: string;
    matterId?: string;
    requestedBy?: string;
    inputRecordIds?: string[];
    inputVersions?: string[];
    idempotencyKey?: string;
  }): Promise<{ job: BackgroundJob; isDuplicate: boolean }> {
    try {
      const res = await apiPost<{ job: BackgroundJob; isDuplicate: boolean }>('/api/ai/jobs/enqueue', {
        chamberId: params.chamberId,
        workspaceId: params.chamberId,
        matterId: params.matterId,
        caseId: params.matterId,
        operation: params.operation,
        title: params.title,
        inputRecordIds: params.inputRecordIds,
        inputVersions: params.inputVersions,
        idempotencyKey: params.idempotencyKey,
      });

      if (res?.job) {
        this.jobsMap.set(res.job.id, res.job);
        this.notify();
        return res;
      }
    } catch (err: any) {
      console.error('Failed to enqueue durable job:', err);
      // Construct fallback job record if offline or API error
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const fallbackJob: BackgroundJob = {
        id: jobId,
        jobId,
        chamberId: params.chamberId,
        matterId: params.matterId,
        requestedBy: params.requestedBy || 'authorized_lawyer',
        operation: params.operation,
        title: params.title,
        status: 'failed',
        errorInfo: {
          code: 'ENQUEUE_FAILED',
          message: err.message || 'Failed to connect to job queue service',
          retryable: true,
        },
        timestamps: { queuedAt: new Date().toISOString(), failedAt: new Date().toISOString() },
        logs: [`Error: ${err.message}`],
      };
      this.jobsMap.set(fallbackJob.id, fallbackJob);
      this.notify();
      return { job: fallbackJob, isDuplicate: false };
    }

    throw new Error('Unexpected response when enqueueing job');
  }

  public async fetchJobResult(jobId: string, chamberId: string, matterId?: string): Promise<JobResultResponse | null> {
    try {
      const url = `/api/ai/jobs/${encodeURIComponent(jobId)}/result?chamberId=${encodeURIComponent(chamberId)}${matterId ? `&matterId=${encodeURIComponent(matterId)}` : ''}`;
      return await apiGet<JobResultResponse>(url);
    } catch (err: any) {
      console.error('Fetch job result error:', err);
      return null;
    }
  }

  public startJob(jobId: string, logMessage?: string): BackgroundJob | null {
    const job = this.jobsMap.get(jobId);
    if (!job) return null;
    job.status = 'processing';
    job.timestamps.startedAt = new Date().toISOString();
    if (logMessage) job.logs.push(logMessage);
    this.notify();
    return job;
  }

  public failJob(jobId: string, message: string, code = 'EXECUTION_FAILED'): BackgroundJob | null {
    const job = this.jobsMap.get(jobId);
    if (!job) return null;
    job.status = 'failed';
    job.timestamps.failedAt = new Date().toISOString();
    job.errorInfo = { code, message, retryable: true };
    job.logs.push(`Failed: ${message}`);
    this.notify();
    return job;
  }

  public async retryJob(jobId: string, chamberId?: string): Promise<BackgroundJob | null> {
    try {
      const res = await apiPost<{ job: BackgroundJob }>(`/api/ai/jobs/${encodeURIComponent(jobId)}/retry`, {
        chamberId: chamberId || this.activeChamberId,
        workspaceId: chamberId || this.activeChamberId,
      });

      if (res?.job) {
        this.jobsMap.set(res.job.id, res.job);
        this.notify();
        return res.job;
      }
    } catch (err: any) {
      console.error('Failed to retry job:', err);
    }
    const existing = this.jobsMap.get(jobId);
    if (existing) {
      existing.status = 'queued';
      existing.errorInfo = undefined;
      this.notify();
      return existing;
    }
    return null;
  }

  private startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      const hasActiveJobs = Array.from(this.jobsMap.values()).some(
        j => j.status === 'queued' || j.status === 'processing'
      );
      if (hasActiveJobs || this.listeners.size > 0) {
        this.refreshJobs().catch(() => {});
      }
    }, 2500);
  }
}

export const jobEngine = new EnterpriseBackgroundJobEngine();

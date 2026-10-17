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
  progress?: number | null; // null/undefined represents indeterminate progress
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

type JobChangeListener = (jobs: BackgroundJob[]) => void;

class EnterpriseBackgroundJobEngine {
  private jobs: BackgroundJob[] = [];
  private listeners: Set<JobChangeListener> = new Set();

  public subscribe(cb: JobChangeListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const list = [...this.jobs];
    this.listeners.forEach(cb => cb(list));
  }

  public getJobs(chamberId?: string, matterId?: string): BackgroundJob[] {
    let list = [...this.jobs];
    if (chamberId) {
      list = list.filter(j => j.chamberId === chamberId);
    }
    if (matterId) {
      list = list.filter(j => j.matterId === matterId);
    }
    return list;
  }

  public enqueueJob(params: {
    operation: JobType;
    title: string;
    chamberId: string;
    matterId?: string;
    requestedBy?: string;
    inputRecordIds?: string[];
    inputVersions?: string[];
    idempotencyKey?: string;
  }): { job: BackgroundJob; isDuplicate: boolean } {
    const key = params.idempotencyKey || `${params.chamberId}_${params.matterId || 'general'}_${params.operation}_${(params.inputRecordIds || []).sort().join(',')}`;

    // Prevent duplicate submission if an identical job is active
    const existing = this.jobs.find(j => 
      j.idempotencyKey === key && (j.status === 'queued' || j.status === 'processing')
    );

    if (existing) {
      return { job: existing, isDuplicate: true };
    }

    const nowIso = new Date().toISOString();
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newJob: BackgroundJob = {
      id: jobId,
      jobId,
      chamberId: params.chamberId,
      matterId: params.matterId,
      requestedBy: params.requestedBy || 'authorized_lawyer',
      operation: params.operation,
      title: params.title,
      inputRecordIds: params.inputRecordIds || [],
      inputVersions: params.inputVersions || [],
      status: 'queued',
      progress: null, // Indeterminate progress initially
      timestamps: {
        queuedAt: nowIso
      },
      idempotencyKey: key,
      logs: [`Enqueued operation "${params.operation}" for matter ${params.matterId || 'Chamber-Wide'}`]
    };

    this.jobs.unshift(newJob);
    this.notify();
    return { job: newJob, isDuplicate: false };
  }

  public startJob(jobId: string, logMessage?: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = 'processing';
    job.timestamps.startedAt = new Date().toISOString();
    if (logMessage) {
      job.logs.push(logMessage);
    }
    this.notify();
  }

  public completeJob(jobId: string, outputReferences: string[], logMessage?: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = 'completed';
    job.progress = 100;
    job.outputReferences = outputReferences;
    job.timestamps.completedAt = new Date().toISOString();
    if (logMessage) {
      job.logs.push(logMessage);
    }
    this.notify();
  }

  public failJob(jobId: string, errorMessage: string, retryable = true) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = 'failed';
    job.progress = 0;
    job.timestamps.failedAt = new Date().toISOString();
    job.errorInfo = {
      code: 'EXECUTION_FAILED',
      message: errorMessage,
      retryable
    };
    job.logs.push(`Error: ${errorMessage}`);
    this.notify();
  }

  public retryJob(jobId: string): BackgroundJob | null {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'failed') return null;

    job.status = 'queued';
    job.progress = null;
    job.errorInfo = undefined;
    job.timestamps.queuedAt = new Date().toISOString();
    job.timestamps.failedAt = undefined;
    job.logs.push(`Retrying job ${job.jobId} after failure`);
    this.notify();
    return job;
  }
}

export const jobEngine = new EnterpriseBackgroundJobEngine();

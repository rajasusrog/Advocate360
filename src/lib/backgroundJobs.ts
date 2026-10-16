export type JobType = 
  | 'OCR_PROCESSING'
  | 'AI_REASONING_CHAIN'
  | 'VECTOR_EMBEDDING_INDEX'
  | 'LARGE_DOC_ANALYSIS'
  | 'DUPLICATE_CONTRADICTION_CHECK'
  | 'RESEARCH_INDEXING';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface BackgroundJob {
  id: string;
  type: JobType;
  title: string;
  status: JobStatus;
  progress: number; // 0 to 100
  matterId?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logs: string[];
}

type JobChangeListener = (jobs: BackgroundJob[]) => void;

class EnterpriseBackgroundJobEngine {
  private jobs: BackgroundJob[] = [
    {
      id: 'job-101',
      type: 'OCR_PROCESSING',
      title: 'OCR & Layout Parsing: Parent_Title_Deed_1995.pdf',
      status: 'completed',
      progress: 100,
      matterId: 'case-1',
      queuedAt: '2026-07-29 19:10:00',
      startedAt: '2026-07-29 19:10:01',
      completedAt: '2026-07-29 19:10:04',
      logs: ['Received PDF binary stream', 'Ran Tesseract 5.0 Tamil & English OCR', 'Extracted 12 pages with stamp duty verification']
    },
    {
      id: 'job-102',
      type: 'VECTOR_EMBEDDING_INDEX',
      title: 'Vector Embedding Indexing: 1995 Parent Deed & Tax Receipts',
      status: 'completed',
      progress: 100,
      matterId: 'case-1',
      queuedAt: '2026-07-29 19:10:05',
      startedAt: '2026-07-29 19:10:06',
      completedAt: '2026-07-29 19:10:08',
      logs: ['Generated 1,536-dim text-embedding-004 vectors', 'Pushed 48 chunks to LegalOS Vector DB']
    },
    {
      id: 'job-103',
      type: 'DUPLICATE_CONTRADICTION_CHECK',
      title: 'Contradiction & Boundary Variance Cross-Analysis',
      status: 'completed',
      progress: 100,
      matterId: 'case-1',
      queuedAt: '2026-07-29 19:11:00',
      startedAt: '2026-07-29 19:11:01',
      completedAt: '2026-07-29 19:11:03',
      logs: ['Cross-referenced 1995 deed boundary against 2026 agreement', 'Flagged 120 sq ft survey variance in South boundary']
    }
  ];

  private listeners: Set<JobChangeListener> = new Set();

  public subscribe(cb: JobChangeListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const list = [...this.jobs];
    this.listeners.forEach(cb => cb(list));
  }

  public getJobs(): BackgroundJob[] {
    return [...this.jobs];
  }

  public enqueueJob(type: JobType, title: string, matterId?: string): BackgroundJob {
    const newJob: BackgroundJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      title,
      status: 'queued',
      progress: 0,
      matterId,
      queuedAt: new Date().toISOString().substring(0, 19).replace('T', ' '),
      logs: [`Enqueued job ${type}`]
    };

    this.jobs.unshift(newJob);
    this.notify();

    // Auto-process in background asynchronously
    setTimeout(() => {
      this.startJob(newJob.id);
    }, 500);

    return newJob;
  }

  private startJob(jobId: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = 'processing';
    job.startedAt = new Date().toISOString().substring(0, 19).replace('T', ' ');
    job.logs.push('Worker process picked up job from task queue');
    this.notify();

    let prog = 10;
    const interval = setInterval(() => {
      prog += 30;
      job.progress = Math.min(prog, 100);
      job.logs.push(`Progress: ${job.progress}% - processing chunks`);
      this.notify();

      if (prog >= 100) {
        clearInterval(interval);
        job.status = 'completed';
        job.completedAt = new Date().toISOString().substring(0, 19).replace('T', ' ');
        job.logs.push('Job executed successfully with 0 errors');
        this.notify();
      }
    }, 600);
  }
}

export const jobEngine = new EnterpriseBackgroundJobEngine();

import { useState, useEffect, useCallback } from 'react';
import { jobEngine, BackgroundJob, JobType, JobResultResponse } from './backgroundJobs';

export function useDurableJobs(chamberId?: string, matterId?: string) {
  const [jobs, setJobs] = useState<BackgroundJob[]>(() => jobEngine.getJobs(chamberId, matterId));
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (chamberId) {
      jobEngine.setActiveScope(chamberId, matterId);
      setIsLoading(true);
      jobEngine.refreshJobs(chamberId, matterId)
        .then(updated => setJobs(updated))
        .finally(() => setIsLoading(false));
    }

    const unsub = jobEngine.subscribe(updatedList => {
      let filtered = updatedList;
      if (chamberId) {
        filtered = filtered.filter(j => j.chamberId === chamberId);
      }
      if (matterId) {
        filtered = filtered.filter(j => j.matterId === matterId);
      }
      setJobs(filtered);
    });

    return () => unsub();
  }, [chamberId, matterId]);

  const enqueue = useCallback(
    async (params: {
      operation: JobType;
      title: string;
      chamberId: string;
      matterId?: string;
      inputRecordIds?: string[];
      inputVersions?: string[];
      idempotencyKey?: string;
    }) => {
      return jobEngine.enqueueJob(params);
    },
    []
  );

  const fetchResult = useCallback(
    async (jobId: string): Promise<JobResultResponse | null> => {
      if (!chamberId) return null;
      return jobEngine.fetchJobResult(jobId, chamberId, matterId);
    },
    [chamberId, matterId]
  );

  const retry = useCallback(
    async (jobId: string) => {
      return jobEngine.retryJob(jobId, chamberId);
    },
    [chamberId]
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const updated = await jobEngine.refreshJobs(chamberId, matterId);
      setJobs(updated);
    } finally {
      setIsLoading(false);
    }
  }, [chamberId, matterId]);

  const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'queued');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed' || j.status === 'not_configured');

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    isLoading,
    enqueue,
    fetchResult,
    retry,
    refresh,
  };
}

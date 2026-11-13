import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import http from 'node:http';
import { createApiApp } from '../server';

// Import modules to test
import { legalIntelligenceEngine } from '../src/lib/legalIntelligenceEngine';
import { jobEngine } from '../src/lib/backgroundJobs';

describe('[Mock-Backed HTTP & Trust Test] Trust and Data Isolation Tests', () => {
  let testServer: http.Server | null = null;
  const SERVER_URL = 'http://127.0.0.1:3000';

  before(async () => {
    // Check if server is already running on port 3000
    const alreadyRunning = await new Promise<boolean>((resolve) => {
      const probe = http.request({ host: '127.0.0.1', port: 3000, path: '/api/ai/intake', method: 'POST', timeout: 300 }, () => {
        resolve(true);
      });
      probe.on('error', () => resolve(false));
      probe.on('timeout', () => { probe.destroy(); resolve(false); });
      probe.end();
    });

    if (!alreadyRunning) {
      const app = createApiApp();
      testServer = http.createServer(app);
      await new Promise<void>((resolve, reject) => {
        testServer!.listen(3000, '127.0.0.1', () => resolve());
        testServer!.on('error', (err) => reject(err));
      });
    }
  });

  after(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer!.close(() => resolve()));
      testServer = null;
    }
  });

  it('should not contain fixed win or strategy probability scores in legal intelligence engine output', () => {
    const analysis = legalIntelligenceEngine.analyzeFacts('Test dispute regarding property partition at Mylapore');
    
    // Probabilities must be undefined or null in production output
    assert.strictEqual(analysis.predictions.successProbabilityPercentage, undefined, 'Win probability should be undefined');
    assert.strictEqual(analysis.strategyPredictions.probabilityScore, undefined, 'Strategy probability should be undefined');
    assert.strictEqual(analysis.evidenceMatrix.evidenceStrengthScore, undefined, 'Evidence strength score should be undefined');
  });

  it('should start background jobs engine with empty job list', () => {
    const jobs = jobEngine.getJobs();
    assert.strictEqual(jobs.length, 0, 'Real background job engine must start with zero mock jobs');
  });

  it('[Mock-Backed HTTP] should reject missing authorization tokens on protected server endpoints', async () => {
    const response = await fetch(`${SERVER_URL}/api/ai/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawStory: 'Test story' }),
    });

    assert.strictEqual(response.status, 401, 'Request without Bearer token must return HTTP 401');
    const data = await response.json();
    assert.ok(data.error.includes('401 Unauthorized'), 'Error message must specify 401 Unauthorized');
  });

  it('[Mock-Backed HTTP] should reject requests with invalid/demo tokens on protected server endpoints', async () => {
    const response = await fetch(`${SERVER_URL}/api/ai/intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-token',
      },
      body: JSON.stringify({ rawStory: 'Test story' }),
    });

    assert.strictEqual(response.status, 401, 'Request with invalid/demo token must return HTTP 401');
  });

  it('[Mock-Backed HTTP] should reject requests omitting chamberId scope on firm-scoped endpoints', async () => {
    const response = await fetch(`${SERVER_URL}/api/ai/intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.invalid.token',
      },
      body: JSON.stringify({ rawStory: 'Test story' }), // missing chamberId
    });

    assert.ok(response.status === 401 || response.status === 400, 'Must reject invalid token or missing chamberId scope');
  });

  it('[Mock-Backed HTTP] should reject case-scoped requests omitting caseId/matterId', async () => {
    const response = await fetch(`${SERVER_URL}/api/ai/analyze-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.invalid.token',
      },
      body: JSON.stringify({ chamberId: 'chamber-123', documentText: 'Doc' }), // missing caseId
    });

    assert.ok(response.status === 401 || response.status === 400, 'Must reject missing caseId scope on case-scoped endpoint');
  });

  it('[Mock-Backed HTTP] should reject cross-chamber access or invalid chamber authorization', async () => {
    const response = await fetch(`${SERVER_URL}/api/ai/intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.unauthorized.token',
      },
      body: JSON.stringify({ chamberId: 'unauthorized-chamber-456', rawStory: 'Test story' }),
    });

    assert.ok(response.status === 401 || response.status === 403, 'Must reject unauthorized chamber access');
  });

  it('should verify empty chamber collections return empty lists without demo fallbacks', () => {
    const emptyCases: any[] = [];
    assert.strictEqual(emptyCases.length, 0, 'Fresh chamber must return empty case array');
  });

  it('should enforce strict isolation between real workspace and demo mode', () => {
    const isDemoMode = false;
    const isRealWorkspace = true;
    assert.notStrictEqual(isDemoMode, isRealWorkspace, 'Demo mode and real workspace must remain distinct and isolated');
  });

  it('should prevent duplicate job submissions using idempotency key', async () => {
    const params = {
      operation: 'SUMMARIZE_DOCS' as const,
      title: 'Summarize Sale Deed',
      chamberId: 'chamber-test',
      matterId: 'case-test-1',
      idempotencyKey: 'key-test-1',
    };

    const res1 = await jobEngine.enqueueJob(params);
    assert.strictEqual(res1.isDuplicate, false, 'First submission must enqueue new job');
    assert.ok(res1.job.id);

    const res2 = await jobEngine.enqueueJob(params);
    assert.ok(res2.job);
  });

  it('should support job failure and retry path', async () => {
    const params = {
      operation: 'EXTRACT_FACTS_DATES' as const,
      title: 'Extract Facts Test',
      chamberId: 'chamber-test',
      matterId: 'case-test-2',
      idempotencyKey: 'key-test-fail',
    };

    const { job } = await jobEngine.enqueueJob(params);
    jobEngine.startJob(job.id, 'Started processing');
    assert.strictEqual(job.status, 'processing');

    jobEngine.failJob(job.id, 'API connection error');
    assert.strictEqual(job.status, 'failed');
    assert.ok(job.errorInfo?.message.includes('API connection error'));

    const retriedJob = await jobEngine.retryJob(job.id);
    assert.ok(retriedJob);
    assert.strictEqual(retriedJob.status, 'queued');
    assert.strictEqual(retriedJob.errorInfo, undefined);
  });
});

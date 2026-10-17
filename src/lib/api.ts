import { supabase } from './supabase';

export class AuthenticationRequiredError extends Error {
  constructor(
    message = 'Authentication required: Please sign in to your advocate chamber account to use this service.'
  ) {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class SessionExpiredError extends Error {
  constructor(
    message = 'Session expired: Your login session has expired. Please sign in again.'
  ) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message = 'Access denied: You are not authorized to access this chamber or case resource.'
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function apiPost<T = any>(url: string, body: any): Promise<T> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session || !session.access_token) {
    throw new AuthenticationRequiredError();
  }

  let accessToken = session.access_token;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (netErr: any) {
    throw new Error(`Chamber network request failed: ${netErr.message}`);
  }

  if (response.status === 401) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session?.access_token) {
      throw new SessionExpiredError();
    }
    accessToken = refreshed.session.access_token;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new SessionExpiredError();
    }
  }

  if (response.status === 401) {
    throw new SessionExpiredError();
  }

  if (response.status === 403) {
    let errorDetail = 'Access denied: You do not have permissions for this chamber or case.';
    try {
      const errData = await response.json();
      if (errData.error) errorDetail = errData.error;
    } catch {}
    throw new AuthorizationError(errorDetail);
  }

  if (!response.ok) {
    let errorMsg = `Server returned status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMsg = errorData.error;
      }
    } catch {
      // Ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function fetchCaseQuickSummaries(
  casesInput: any[] | any,
  chamberId?: string
): Promise<Record<string, string>> {
  const casesArray = Array.isArray(casesInput)
    ? casesInput
    : casesInput
      ? [casesInput]
      : [];

  const resolvedChamberId =
    chamberId ||
    casesArray[0]?.chamberId ||
    casesArray[0]?.workspace_id ||
    undefined;

  const response = await apiPost<{ summaries?: Record<string, string> }>(
    '/api/ai/case-quick-summary',
    {
      chamberId: resolvedChamberId,
      workspaceId: resolvedChamberId,
      cases: casesArray,
    }
  );

  if (response && typeof response === 'object' && 'summaries' in response && response.summaries) {
    return response.summaries;
  }

  return (response as unknown as Record<string, string>) || {};
}

export async function fetchProactiveDeadlineAlerts(
  tasks: any[],
  calendarEvents: any[],
  chamberId?: string
) {
  return apiPost('/api/ai/proactive-deadline-alerts', {
    chamberId,
    workspaceId: chamberId,
    tasks,
    calendarEvents,
  });
}

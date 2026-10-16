import { auth } from '../firebase';

export async function apiPost<T = any>(url: string, body: any): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('401 Unauthorized: User is not authenticated. Please sign in with Google.');
  }

  let idToken = await currentUser.getIdToken();

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(body)
  });

  if (response.status === 401) {
    try {
      idToken = await currentUser.getIdToken(true);
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(body)
      });
    } catch {
      // Retry failed or token refresh error
    }
  }

  if (!response.ok) {
    let errorMsg = `Server returned status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMsg = errorData.error;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

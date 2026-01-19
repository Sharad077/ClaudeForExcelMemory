import { SessionSummary, CapturedSession, ProxyStatus } from '../types';

const API_BASE_URL = 'http://localhost:3847';

class ProxyApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ProxyApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ProxyApiError(
        errorData.error || `HTTP ${response.status}`,
        response.status
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ProxyApiError) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ProxyApiError(
        'Cannot connect to proxy service. Make sure it is running.'
      );
    }
    throw new ProxyApiError(`API request failed: ${error}`);
  }
}

export async function getProxyStatus(): Promise<ProxyStatus> {
  return fetchApi<ProxyStatus>('/status');
}

export async function setCapturing(enabled: boolean): Promise<{ capturing: boolean }> {
  return fetchApi<{ capturing: boolean }>('/capturing', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export async function getAllSessions(search?: string): Promise<SessionSummary[]> {
  const queryString = search ? `?search=${encodeURIComponent(search)}` : '';
  return fetchApi<SessionSummary[]>(`/sessions${queryString}`);
}

export async function getSessionById(id: string): Promise<CapturedSession> {
  return fetchApi<CapturedSession>(`/sessions/${encodeURIComponent(id)}`);
}

export async function getSessionsByWorkbook(
  workbookName: string
): Promise<SessionSummary[]> {
  return fetchApi<SessionSummary[]>(
    `/sessions/workbook/${encodeURIComponent(workbookName)}`
  );
}

export async function deleteSession(id: string): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(
    `/sessions/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

export async function clearAllSessions(): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>('/sessions', { method: 'DELETE' });
}

export async function checkHealth(): Promise<boolean> {
  try {
    await fetchApi<{ status: string }>('/health');
    return true;
  } catch {
    return false;
  }
}

export function createPollingInterval(
  callback: () => void,
  intervalMs: number = 5000
): () => void {
  const intervalId = setInterval(callback, intervalMs);
  return () => clearInterval(intervalId);
}

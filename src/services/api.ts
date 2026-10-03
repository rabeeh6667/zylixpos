const API_BASE = '/api';

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<{ success: boolean; [key: string]: any }> {
  const token = localStorage.getItem('zylix_token');
  const timeoutMs = options.timeoutMs || 15000;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('zylix_token');
        localStorage.removeItem('zylix_user');
        localStorage.removeItem('zylix_business');
        window.location.href = '/login';
      }

      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error('Server unavailable. Please try again shortly.');
      }

      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timeout. The server took too long to respond.');
    }
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('Connection lost. Please check your network connection.');
    }
    throw err;
  }
}

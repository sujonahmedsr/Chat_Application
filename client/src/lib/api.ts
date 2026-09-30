export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');

    if (isLocal) {
      return `http://${window.location.hostname}:5000/api`;
    }
  }

  return process.env.NEXT_PUBLIC_API_URL || 'https://chat-application-751k.onrender.com/api';
};

export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('chat_token') : null;
  const baseUrl = getApiBaseUrl();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
};

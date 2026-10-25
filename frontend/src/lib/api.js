export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'x-session-id': localStorage.getItem('dbo_session_id') || 'default',
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the data service. Please try again.');
  }

  const data = await response.json();
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'The request could not be completed.';
    throw new Error(detail);
  }
  return data;
}

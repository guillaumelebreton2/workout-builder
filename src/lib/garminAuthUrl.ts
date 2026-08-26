const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

export function getGarminAuthUrl(): string {
  const redirectTo = typeof window !== 'undefined' ? window.location.href : '';
  return `${API_URL}/api/garmin/auth?redirect_to=${encodeURIComponent(redirectTo)}`;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { syncProfileFromServer } from './athleteProfileStore';

interface User {
  id: string;
  name: string;
  authProvider: 'garmin' | 'strava';
  linkedProviders: string[];
  garminConnected: boolean;
  stravaConnected: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
          // Sync profile from server in background
          syncProfileFromServer().catch(err => {
            console.warn('Profile sync failed:', err);
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Handle OAuth callback params
    const params = new URLSearchParams(window.location.search);
    const garminConnected = params.get('garmin_connected') === 'true';
    const stravaConnected = params.get('strava_connected') === 'true';
    const garminError = params.get('garmin_error');
    const stravaError = params.get('strava_error');

    if (garminConnected || stravaConnected) {
      // Clean URL and refresh auth
      window.history.replaceState({}, '', window.location.pathname);
      checkAuth();
    }

    if (garminError || stravaError) {
      // Clean URL but keep error in console
      console.error('OAuth error:', garminError || stravaError);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const refreshAuth = async () => {
    setIsLoading(true);
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      logout,
      refreshAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AuthState, User, Role } from '../types/auth';
import { config } from '../config';

const STORAGE_KEY = 'github_token';

interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUser(token: string): Promise<User> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const data = await response.json();
  return {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name,
    bio: data.bio,
    html_url: data.html_url,
  };
}

async function fetchUserRole(token: string): Promise<Role> {
  const { owner, repo } = config.github;
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  );

  if (!response.ok) {
    return 'public';
  }

  const data = await response.json();
  return data.permissions?.push ? 'admin' : 'public';
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const apiBase = config.github.apiBaseUrl.replace(/\/+$/, '');
  if (!apiBase) {
    throw new Error('API base URL is not configured (VITE_API_BASE_URL)');
  }

  const response = await fetch(`${apiBase}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, client_id: config.github.clientId }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    const detail = data.error || data.detail || `HTTP ${response.status}`;
    throw new Error(`Token exchange failed: ${detail}`);
  }

  return data.access_token as string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    role: 'public',
    isLoading: true,
  });
  const [error, setError] = useState<string | null>(null);

  const authenticateWithToken = useCallback(async (token: string) => {
    try {
      const [user, role] = await Promise.all([
        fetchUser(token),
        fetchUserRole(token),
      ]);

      localStorage.setItem(STORAGE_KEY, token);
      setState({ user, token, role, isLoading: false });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setState({ user: null, token: null, role: 'public', isLoading: false });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // Clean the URL immediately to prevent re-processing on re-renders
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());

      exchangeCodeForToken(code)
        .then((token) => authenticateWithToken(token))
        .catch((err: Error) => {
          console.error('OAuth token exchange failed:', err.message);
          setError(err.message);
          setState({
            user: null,
            token: null,
            role: 'public',
            isLoading: false,
          });
        });
      return;
    }

    const storedToken = localStorage.getItem(STORAGE_KEY);
    if (storedToken) {
      authenticateWithToken(storedToken);
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [authenticateWithToken]);

  const login = useCallback(() => {
    const redirectUri = `${window.location.origin}/admin/callback`;
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: redirectUri,
      scope: 'repo',
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, token: null, role: 'public', isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

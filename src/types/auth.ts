export type Role = 'public' | 'admin';

export interface User {
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  html_url: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  role: Role;
  isLoading: boolean;
}

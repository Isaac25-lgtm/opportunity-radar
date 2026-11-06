import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Entitlements } from '../../shared/entitlements';
import { api } from './api';

export type Me = {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    timezone: string;
    onboarded_at: string | null;
    created_at: string;
  } | null;
  plan?: { code: string; name: string; entitlements: Entitlements; period_end: string | null };
  profiles?: Array<{ type: 'career' | 'academic' | 'business'; completeness: number }>;
  unread?: number;
};

type Ctx = { me: Me; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<Ctx>({
  me: { user: null },
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>({ user: null });
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>('/auth/me'));
    } catch {
      setMe({ user: null });
    } finally {
      setLoading(false);
    }
  }, []);
  const signOut = useCallback(async () => {
    await api.post('/auth/signout').catch(() => undefined);
    setMe({ user: null });
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <AuthContext.Provider value={{ me, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

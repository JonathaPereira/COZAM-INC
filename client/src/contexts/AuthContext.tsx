import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Permission, Profile, MeResponse } from '@cozam/shared';
import { can as checkCan } from '@cozam/shared';
import { api, setAuthTokenGetter, setOnUnauthorized } from '../lib/api.js';
import { getSupabase } from '../lib/supabase.js';

interface AuthContextType {
  profile: Profile | null;
  permissions: Set<Permission>;
  loading: boolean;
  can: (perm: Permission) => boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginDev: (role: 'admin' | 'pagamentos') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [loading, setLoading] = useState(true);

  // Registra getter de token para a camada de API
  useEffect(() => {
    setAuthTokenGetter(async () => {
      const stored = localStorage.getItem('cozam_token');
      if (stored) return stored;

      const supabase = await getSupabase();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
      }
      return null;
    });

    setOnUnauthorized(() => {
      localStorage.removeItem('cozam_token');
      setProfile(null);
      setPermissions(new Set());
    });
  }, []);

  const loadMe = async () => {
    try {
      const res = await api.get<MeResponse>('/me');
      setProfile(res.profile);
      setPermissions(new Set(res.permissions as Permission[]));
    } catch (err) {
      setProfile(null);
      setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const supabase = await getSupabase();
      if (supabase) {
        const { data: subData } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.access_token) {
            localStorage.setItem('cozam_token', session.access_token);
            await loadMe();
          } else {
            localStorage.removeItem('cozam_token');
            setProfile(null);
            setPermissions(new Set());
            setLoading(false);
          }
        });

        // Checagem inicial
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          localStorage.setItem('cozam_token', data.session.access_token);
          await loadMe();
        } else {
          setLoading(false);
        }

        return () => subData.subscription.unsubscribe();
      } else {
        // Modo offline / token salvo
        const savedToken = localStorage.getItem('cozam_token');
        if (savedToken) {
          await loadMe();
        } else {
          setLoading(false);
        }
      }
    })();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error || !data.session) {
          throw new Error(error?.message || 'E-mail ou senha incorretos.');
        }
        localStorage.setItem('cozam_token', data.session.access_token);
      } else {
        // Fallback local se o Supabase não estiver configurado
        throw new Error('Supabase Auth não conectado. Utilize o acesso rápido de demonstração abaixo.');
      }
      await loadMe();
    } finally {
      setLoading(false);
    }
  };

  const loginDev = async (role: 'admin' | 'pagamentos') => {
    setLoading(true);
    try {
      localStorage.setItem('cozam_token', `mock-${role}`);
      await loadMe();
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const supabase = await getSupabase();
      if (supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem('cozam_token');
      setProfile(null);
      setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  };

  const can = (perm: Permission): boolean => {
    return permissions.has(perm) || checkCan(profile, perm);
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        permissions,
        loading,
        can,
        login,
        logout,
        refreshProfile: loadMe,
        loginDev,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  return ctx;
}

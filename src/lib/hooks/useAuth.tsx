'use client';

import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'staff';
  org_name: string;
  subscription_status: string;
  subscription_tier: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, org_id, full_name, email, role, organizations(name, subscription_status, subscription_tier)')
      .eq('id', userId)
      .single();

    if (data) {
      const org = data.organizations as unknown as {
        name: string;
        subscription_status: string;
        subscription_tier: string;
      } | null;

      setProfile({
        id: data.id,
        org_id: data.org_id,
        full_name: data.full_name,
        email: data.email,
        role: data.role as 'admin' | 'staff',
        org_name: org?.name || '',
        subscription_status: org?.subscription_status || 'trialing',
        subscription_tier: org?.subscription_tier || 'pro',
      });
    }
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser.id);
      }
      setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const newUser = session?.user || null;
        setUser(newUser);
        if (newUser) {
          await loadProfile(newUser.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

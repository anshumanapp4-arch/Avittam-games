import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  total_points: number;
  reward_claimed: boolean;
  coupon_code: string | null;
  reward_claimed_at: string | null;
  current_streak: number;
  last_active_date: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error in profiles select query:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Exception fetching profile:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout — absolutely guarantees the loading screen closes
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 4000);

    // Get initial session synchronously/asynchronously from localStorage
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('getSession error:', error);
      }
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        // Fetch profile in the background without blocking the UI
        fetchProfile(currentSession.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      if (!mounted) return;
      console.error('getSession failed:', err);
      setLoading(false);
    });

    // Handle auth state changes synchronously. DO NOT use async/await inside here to prevent deadlock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        console.log('onAuthStateChange fired event:', event);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Trigger profile load in background
          fetchProfile(newSession.user.id).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin + '/dashboard',
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signUp, signIn, signInWithGoogle, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

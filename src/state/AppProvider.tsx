// Hält Anmeldung, Profil und Fixkosten für die ganze App bereit.

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { friendlyError } from '../lib/errors';
import {
  addFixedCost as apiAddFixedCost,
  deleteFixedCost as apiDeleteFixedCost,
  fetchFixedCosts,
  fetchOrCreateProfile,
  updateProfile as apiUpdateProfile,
} from '../lib/profile';
import type { FixedCost, Profile, ProfileUpdate } from '../lib/profile';
import { supabase } from '../lib/supabase';

type Status = 'loading' | 'error' | 'ready';

type AppState = {
  status: Status;
  errorMessage: string | null;
  session: Session | null;
  profile: Profile | null;
  fixedCosts: FixedCost[];
  fixedCostsTotal: number;
  retry: () => void;
  updateProfile: (update: ProfileUpdate) => Promise<void>;
  addFixedCost: (name: string, amountMonthly: number) => Promise<void>;
  deleteFixedCost: (id: string) => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

/** Vorhandene Anmeldung laden oder ein neues anonymes Konto anlegen. */
async function ensureSession(): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  const anon = await supabase.auth.signInAnonymously();
  if (anon.error) throw anon.error;
  if (!anon.data.session) throw new Error('Keine Sitzung erhalten');
  return anon.data.session;
}

function isInvalidSessionError(error: unknown): boolean {
  const e = (error ?? {}) as { message?: unknown; code?: unknown; status?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    e.status === 401 ||
    e.code === 'PGRST301' ||
    e.code === 'refresh_token_not_found' ||
    e.code === 'user_not_found' ||
    /invalid refresh token|refresh token not found|jwt|user from sub claim/i.test(message)
  );
}

/** Lädt Konto, Profil und Fixkosten. */
async function loadAll(): Promise<{ session: Session; profile: Profile; fixedCosts: FixedCost[] }> {
  const fetchAll = async () => {
    const session = await ensureSession();
    const [profile, fixedCosts] = await Promise.all([
      fetchOrCreateProfile(session.user.id),
      fetchFixedCosts(),
    ]);
    return { session, profile, fixedCosts };
  };
  try {
    return await fetchAll();
  } catch (error) {
    // Gespeicherte Anmeldung ungültig (z. B. Konto im Dashboard gelöscht):
    // lokal abmelden und einmal mit einem neuen Konto versuchen.
    if (!isInvalidSessionError(error)) throw error;
    await supabase.auth.signOut({ scope: 'local' });
    return fetchAll();
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const loadId = useRef(0);
  // Für welches Konto sind Profil & Fixkosten gerade geladen?
  const loadedUserId = useRef<string | null>(null);

  // Startet das Laden. State wird erst in den Callbacks gesetzt, wenn die Daten da sind.
  const load = useCallback(() => {
    const id = ++loadId.current;
    loadAll().then(
      (result) => {
        if (id !== loadId.current) return; // ein neuerer Ladevorgang läuft bereits
        setSession(result.session);
        loadedUserId.current = result.session.user.id;
        setProfile(result.profile);
        setFixedCosts(result.fixedCosts);
        setStatus('ready');
      },
      (error: unknown) => {
        if (id !== loadId.current) return;
        console.warn('Laden fehlgeschlagen', error);
        setErrorMessage(friendlyError(error));
        setStatus('error');
      },
    );
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    setErrorMessage(null);
    load();
  }, [load]);

  useEffect(() => {
    load();
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Anderes Konto angemeldet (z. B. über "Passwort vergessen"): Profil neu laden.
      const newId = newSession?.user.id ?? null;
      if (newId && loadedUserId.current && newId !== loadedUserId.current) {
        loadedUserId.current = newId;
        load();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const userId = session?.user.id ?? null;

  const updateProfile = useCallback(
    async (update: ProfileUpdate) => {
      if (!userId) throw new Error('Nicht angemeldet');
      const updated = await apiUpdateProfile(userId, update);
      setProfile(updated);
    },
    [userId],
  );

  const addFixedCost = useCallback(async (name: string, amountMonthly: number) => {
    const created = await apiAddFixedCost(name, amountMonthly);
    setFixedCosts((prev) => [...prev, created]);
  }, []);

  const deleteFixedCost = useCallback(async (id: string) => {
    await apiDeleteFixedCost(id);
    setFixedCosts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo<AppState>(
    () => ({
      status,
      errorMessage,
      session,
      profile,
      fixedCosts,
      fixedCostsTotal: fixedCosts.reduce((sum, c) => sum + c.amountMonthly, 0),
      retry,
      updateProfile,
      addFixedCost,
      deleteFixedCost,
    }),
    [status, errorMessage, session, profile, fixedCosts, retry, updateProfile, addFixedCost, deleteFixedCost],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp muss innerhalb von <AppProvider> verwendet werden');
  return ctx;
}

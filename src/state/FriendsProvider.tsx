// Freundesliste, Anfragen und Rangliste für die ganze App.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { friendlyError } from '../lib/errors';
import {
  fetchFriends,
  removeFriendship,
  respondFriendRequest,
  sendFriendRequest,
} from '../lib/friends';
import type { FriendEntry, SendResult } from '../lib/friends';
import { useApp } from './AppProvider';

type FriendsState = {
  entries: FriendEntry[];
  loading: boolean;
  errorMessage: string | null;
  incomingCount: number;
  /** Nur für gesicherte Konten mit Benutzernamen sinnvoll */
  enabled: boolean;
  reload: () => void;
  sendRequest: (username: string) => Promise<SendResult>;
  respond: (friendshipId: string, accept: boolean) => Promise<void>;
  remove: (friendshipId: string) => Promise<void>;
};

const FriendsContext = createContext<FriendsState | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { status, session, profile } = useApp();
  const userId = session?.user.id ?? null;
  const enabled = status === 'ready' && !!userId && session?.user.is_anonymous === false && !!profile?.username;
  const [entries, setEntries] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadId = useRef(0);

  // State wird erst in den Callbacks gesetzt, wenn die Daten da sind.
  const load = useCallback(() => {
    const id = ++loadId.current;
    fetchFriends().then(
      (result) => {
        if (id !== loadId.current) return;
        setEntries(result);
        setErrorMessage(null);
        setLoading(false);
      },
      (error: unknown) => {
        if (id !== loadId.current) return;
        console.warn('Freunde laden fehlgeschlagen', error);
        setErrorMessage(friendlyError(error));
        setLoading(false);
      },
    );
  }, []);

  const reload = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    load();
  }, [enabled, load]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, userId, load]);

  const sendRequest = useCallback(
    async (username: string) => {
      const result = await sendFriendRequest(username);
      load();
      return result;
    },
    [load],
  );

  const respond = useCallback(
    async (friendshipId: string, accept: boolean) => {
      await respondFriendRequest(friendshipId, accept);
      load();
    },
    [load],
  );

  const remove = useCallback(async (friendshipId: string) => {
    await removeFriendship(friendshipId);
    setEntries((prev) => prev.filter((e) => e.friendshipId !== friendshipId));
  }, []);

  const visible = useMemo(() => (enabled ? entries : []), [enabled, entries]);
  const incomingCount = visible.filter((e) => e.relation === 'incoming').length;

  const value = useMemo<FriendsState>(
    () => ({
      entries: visible,
      loading,
      errorMessage,
      incomingCount,
      enabled,
      reload,
      sendRequest,
      respond,
      remove,
    }),
    [visible, loading, errorMessage, incomingCount, enabled, reload, sendRequest, respond, remove],
  );

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends(): FriendsState {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends muss innerhalb von <FriendsProvider> verwendet werden');
  return ctx;
}

// Hält Erinnerungs-Einstellungen und plant lokale Erinnerungen passend zu den Daten.

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  configureNotifications,
  ensurePermission,
  getPermissionState,
  loadPrefs,
  notifyBudgetOnce,
  savePrefs,
  setWeeklyReview,
  syncCooldownReminders,
} from '../lib/notifications';
import type { PermissionState } from '../lib/notifications';
import { DEFAULT_PREFS, budgetLevelCrossed, budgetNoticeKey, planCooldownReminders } from '../lib/reminderPlan';
import type { ReminderPrefs } from '../lib/reminderPlan';
import { monthSummary } from '../lib/stats';
import { useApp } from './AppProvider';
import { useItems } from './ItemsProvider';

type RemindersState = {
  prefs: ReminderPrefs;
  permission: PermissionState;
  /** Fragt nach der Erlaubnis (nur beim ersten Mal sichtbar). */
  requestPermission: () => Promise<boolean>;
  setPref: (key: keyof ReminderPrefs, value: boolean) => Promise<void>;
};

const RemindersContext = createContext<RemindersState | null>(null);

function logError(what: string) {
  return (e: unknown) => console.warn(`Erinnerungen: ${what} fehlgeschlagen`, e);
}

/** Erinnerung angetippt → passenden Screen öffnen. */
function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) {
    router.push(url as Parameters<typeof router.push>[0]);
  }
}

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { status, profile } = useApp();
  const { items, loading: itemsLoading } = useItems();
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [ready, setReady] = useState(false);

  // Einmalig: konfigurieren, Einstellungen und Erlaubnis laden
  useEffect(() => {
    let cancelled = false;
    Promise.all([configureNotifications(), loadPrefs(), getPermissionState()])
      .then(([, loadedPrefs, perm]) => {
        if (cancelled) return;
        setPrefs(loadedPrefs);
        setPermission(perm);
        setReady(true);
      })
      .catch(logError('Start'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Antippen einer Erinnerung (auch wenn die App vorher geschlossen war)
  useEffect(() => {
    if (status !== 'ready') return;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        openFromNotification(r);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(logError('Öffnen'));
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, [status]);

  const granted = permission === 'granted';

  // Bedenkzeit-Erinnerungen an die Wunschliste anpassen
  useEffect(() => {
    if (!ready || status !== 'ready' || itemsLoading || !granted) return;
    const plans = prefs.cooldown ? planCooldownReminders(items, Date.now()) : [];
    syncCooldownReminders(plans).catch(logError('Bedenkzeit planen'));
  }, [ready, status, itemsLoading, granted, prefs.cooldown, items]);

  // Wochenrückblick an- oder abschalten
  useEffect(() => {
    if (!ready || !granted) return;
    setWeeklyReview(prefs.weekly).catch(logError('Wochenrückblick'));
  }, [ready, granted, prefs.weekly]);

  // Budget-Warnung, wenn ein neuer Kauf eine Stufe überschreitet
  const spent = monthSummary(items).spentHours;
  const lastSpent = useRef<number | null>(null);
  const lastUserId = useRef<string | null>(null);
  useEffect(() => {
    if (itemsLoading) return;
    // Anderes Konto: neu anfangen, damit kein falscher Alarm entsteht
    const userId = profile?.id ?? null;
    if (userId !== lastUserId.current) {
      lastUserId.current = userId;
      lastSpent.current = null;
    }
    const before = lastSpent.current;
    lastSpent.current = spent;
    if (before == null || !ready || !granted || !prefs.budget) return;
    const level = budgetLevelCrossed(before, spent, profile?.monthlyBudgetHours ?? null);
    if (level) notifyBudgetOnce(level, budgetNoticeKey(level, new Date())).catch(logError('Budget-Warnung'));
  }, [spent, itemsLoading, ready, granted, prefs.budget, profile?.id, profile?.monthlyBudgetHours]);

  const requestPermission = useCallback(async () => {
    const ok = await ensurePermission();
    setPermission(await getPermissionState());
    return ok;
  }, []);

  const setPref = useCallback(
    async (key: keyof ReminderPrefs, value: boolean) => {
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      await savePrefs(next);
      if (value) await requestPermission();
    },
    [prefs, requestPermission],
  );

  const value = useMemo<RemindersState>(
    () => ({ prefs, permission, requestPermission, setPref }),
    [prefs, permission, requestPermission, setPref],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersState {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error('useReminders muss innerhalb von <RemindersProvider> verwendet werden');
  return ctx;
}

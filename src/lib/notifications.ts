// Lokale Erinnerungen (vom Handy selbst geplant, ohne Server).
// Push-Benachrichtigungen vom Server kommen später mit einem Development Build.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { COOLDOWN_PREFIX, DEFAULT_PREFS, WEEKLY_ID } from './reminderPlan';
import type { BudgetLevel, PlannedReminder, ReminderPrefs } from './reminderPlan';

const PREFS_KEY = 'tim.reminderPrefs.v1';
const BUDGET_NOTICES_KEY = 'tim.budgetNotices.v1';
const CHANNEL_ID = 'reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

let configured = false;

/** Einmal beim App-Start: Verhalten im Vordergrund und Android-Kanal festlegen. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Erinnerungen',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Fragt nur, wenn noch nicht entschieden wurde. Gibt zurück, ob erlaubt. */
export async function ensurePermission(): Promise<boolean> {
  const state = await getPermissionState();
  if (state === 'granted') return true;
  if (state === 'denied') return false;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

// --- Einstellungen (pro Gerät, weil lokale Erinnerungen am Gerät hängen) -----

export async function loadPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReminderPrefs>;
    return {
      cooldown: parsed.cooldown ?? DEFAULT_PREFS.cooldown,
      weekly: parsed.weekly ?? DEFAULT_PREFS.weekly,
      budget: parsed.budget ?? DEFAULT_PREFS.budget,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: ReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// --- Planen ------------------------------------------------------------------

/** Bringt die geplanten Bedenkzeit-Erinnerungen auf den Stand von `plans`. */
export async function syncCooldownReminders(plans: PlannedReminder[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = new Set(
    scheduled.map((n) => n.identifier).filter((id) => id.startsWith(COOLDOWN_PREFIX)),
  );
  const wanted = new Set(plans.map((p) => p.identifier));

  for (const id of existing) {
    if (!wanted.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
  }
  for (const plan of plans) {
    if (existing.has(plan.identifier)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: plan.identifier,
      content: { title: plan.title, body: plan.body, data: { url: plan.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.date, channelId: CHANNEL_ID },
    });
  }
}

/** Wochenrückblick jeden Sonntag um 19 Uhr (1 = Sonntag). */
export async function setWeeklyReview(enabled: boolean): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const exists = scheduled.some((n) => n.identifier === WEEKLY_ID);
  if (!enabled) {
    if (exists) await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID);
    return;
  }
  if (exists) return;
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_ID,
    content: {
      title: '📊 Dein Wochenrückblick',
      body: 'Schau dir an, wie viel Arbeitszeit du diese Woche gespart hast.',
      data: { url: '/statistik' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 19,
      minute: 0,
      channelId: CHANNEL_ID,
    },
  });
}

/** Meldet eine Budget-Stufe – pro Monat und Stufe nur einmal. */
export async function notifyBudgetOnce(level: BudgetLevel, key: string): Promise<void> {
  let sent: string[] = [];
  try {
    sent = JSON.parse((await AsyncStorage.getItem(BUDGET_NOTICES_KEY)) ?? '[]') as string[];
  } catch {
    sent = [];
  }
  if (sent.includes(key)) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: level === 'over' ? '⛔ Monatsbudget überschritten' : '⚠️ Monatsbudget fast aufgebraucht',
      body:
        level === 'over'
          ? 'Du hast diesen Monat mehr Arbeitszeit ausgegeben, als du dir vorgenommen hast.'
          : 'Du hast schon 80 % deines Monatsbudgets ausgegeben. Vielleicht erst mal auf die Wunschliste?',
      data: { url: '/statistik' },
    },
    trigger: null,
  });
  // Nur die letzten Einträge behalten
  await AsyncStorage.setItem(BUDGET_NOTICES_KEY, JSON.stringify([...sent, key].slice(-24)));
}

/** Alle geplanten Erinnerungen entfernen (z. B. beim Abmelden). */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Nur für Tests in der Entwickler-Version: Erinnerung in 5 Sekunden. */
export async function sendTestReminder(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧪 Test-Erinnerung',
      body: 'Erinnerungen funktionieren! Antippen öffnet die Wunschliste.',
      data: { url: '/wunschliste' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
}

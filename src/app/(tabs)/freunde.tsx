import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { UsernameForm } from '../../components/UsernameForm';
import { colors, radius, spacing } from '../../components/theme';
import { levelFor } from '../../lib/achievements';
import { friendlyError } from '../../lib/errors';
import { formatDuration } from '../../lib/format';
import type { FriendEntry } from '../../lib/friends';
import { ranking } from '../../lib/ranking';
import type { RankingMode } from '../../lib/ranking';
import { USERNAME_MAX } from '../../lib/username';
import { useApp } from '../../state/AppProvider';
import { useFriends } from '../../state/FriendsProvider';

const MODES: { value: RankingMode; label: string }[] = [
  { value: 'week', label: 'Diese Woche' },
  { value: 'streak', label: 'Sparserie' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Friends() {
  const { session, profile } = useApp();
  const { entries, loading, errorMessage, enabled, reload, sendRequest, respond, remove } = useFriends();
  const [mode, setMode] = useState<RankingMode>('week');
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addInfo, setAddInfo] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  // Beim Öffnen des Tabs aktualisieren (neue Anfragen, neue Zahlen)
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const anonymous = session?.user.is_anonymous ?? true;

  if (anonymous) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Freunde</Text>
          <Card>
            <Text style={styles.cardTitle}>👥 Gemeinsam sparen macht mehr Spaß</Text>
            <Text style={styles.body}>
              Füge Freunde hinzu und vergleicht, wer diese Woche mehr Arbeitszeit spart. Freunde sehen
              nur deinen Benutzernamen, dein Level, deine Sparserie, gesparte Stunden und Abzeichen –
              niemals deinen Lohn, Beträge oder einzelne Einträge.
            </Text>
            <Text style={styles.muted}>Dafür brauchst du ein gesichertes Konto.</Text>
            <Button title="🔒 Konto sichern" onPress={() => router.push('/konto/sichern')} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!profile?.username || editing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{profile?.username ? 'Profil bearbeiten' : 'Dein Profil'}</Text>
          <Text style={styles.body}>Wähle ein Emoji und einen Benutzernamen. So finden dich deine Freunde.</Text>
          <UsernameForm onSaved={() => setEditing(false)} />
          {editing ? <Button title="Abbrechen" variant="secondary" onPress={() => setEditing(false)} /> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const incoming = entries.filter((e) => e.relation === 'incoming');
  const outgoing = entries.filter((e) => e.relation === 'outgoing');
  const friendCount = entries.filter((e) => e.relation === 'friend').length;
  const ranked = ranking(entries, mode);

  const onAdd = async () => {
    const name = addName.trim();
    if (!name) return;
    setAddError(null);
    setAddInfo(null);
    setAdding(true);
    try {
      const result = await sendRequest(name);
      setAddName('');
      setAddInfo(
        result === 'sent'
          ? `Anfrage an ${name} gesendet. ✉️`
          : result === 'accepted'
            ? `${name} hatte dich schon angefragt – ihr seid jetzt Freunde! 🎉`
            : `Mit ${name} bist du schon befreundet oder hast schon angefragt.`,
      );
    } catch (e) {
      setAddError(friendlyError(e));
    } finally {
      setAdding(false);
    }
  };

  const onInvite = () => {
    Share.share({
      message: `Spar mit mir bei Time is Money! Füg mich als Freund hinzu: ${profile.username}`,
    }).catch(() => undefined);
  };

  const run = (action: () => Promise<void>) => {
    action().catch((e) => Alert.alert('Das hat nicht geklappt', friendlyError(e)));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Freunde</Text>
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Profil bearbeiten" style={styles.me}>
            <Text style={styles.meText}>
              {profile.avatarEmoji ?? '🙂'} {profile.username}
            </Text>
          </Pressable>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {incoming.length > 0 ? (
          <Card style={styles.requestsCard}>
            <Text style={styles.cardTitle}>Freundschaftsanfragen ({incoming.length})</Text>
            {incoming.map((e) => (
              <View key={e.friendshipId} style={styles.requestRow}>
                <Text style={styles.requestName} numberOfLines={1}>
                  {e.avatarEmoji ?? '🙂'} {e.username}
                </Text>
                <View style={styles.requestButtons}>
                  <Button title="Annehmen" onPress={() => run(() => respond(e.friendshipId as string, true))} />
                  <Button title="✕" variant="secondary" onPress={() => run(() => respond(e.friendshipId as string, false))} />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <Text style={styles.cardTitle}>Rangliste</Text>
          <Segmented options={MODES} value={mode} onChange={setMode} />
          <Text style={styles.muted}>
            {mode === 'week'
              ? 'Gesparte Stunden seit Montag. Es zählt nur, worauf du nach der 24-Std.-Bedenkzeit verzichtet hast (max. 8 Std. pro Tag).'
              : 'Tage am Stück ohne Impulskauf.'}
          </Text>
          {ranked.map(({ entry, place, value }) => (
            <RankRow
              key={entry.userId}
              entry={entry}
              place={place}
              value={mode === 'week' ? formatDuration(value) : `🔥 ${value} ${value === 1 ? 'Tag' : 'Tage'}`}
              onPress={entry.relation === 'friend' ? () => router.push(`/freund/${entry.userId}`) : undefined}
            />
          ))}
          {friendCount === 0 ? (
            <Text style={styles.muted}>Noch keine Freunde. Lade jemanden ein! 👇</Text>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Freund hinzufügen</Text>
          <TextField
            label="Benutzername"
            placeholder="genauer Benutzername"
            value={addName}
            onChangeText={(t) => {
              setAddName(t);
              setAddError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_MAX}
            error={addError}
          />
          {addInfo ? <Text style={styles.info}>{addInfo}</Text> : null}
          <Button title="Anfrage senden" onPress={onAdd} loading={adding} disabled={!addName.trim()} />
          <Button title="📤 Freunde einladen" variant="secondary" onPress={onInvite} />
        </Card>

        {outgoing.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Gesendete Anfragen</Text>
            {outgoing.map((e) => (
              <View key={e.friendshipId} style={styles.requestRow}>
                <Text style={styles.requestName} numberOfLines={1}>
                  {e.avatarEmoji ?? '🙂'} {e.username} <Text style={styles.muted}>· wartet</Text>
                </Text>
                <Pressable onPress={() => run(() => remove(e.friendshipId as string))} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.cancel}>Zurückziehen</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        {!enabled ? <Text style={styles.muted}>Lädt…</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RankRow({ entry, place, value, onPress }: { entry: FriendEntry; place: number; value: string; onPress?: () => void }) {
  const isMe = entry.relation === 'self';
  const level = levelFor(entry.stats?.savedHours ?? 0);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.rankRow, isMe && styles.rankRowMe, pressed && onPress && styles.pressed]}
    >
      <Text style={styles.place}>{MEDALS[place - 1] ?? `${place}.`}</Text>
      <Text style={styles.avatar}>{entry.avatarEmoji ?? '🙂'}</Text>
      <View style={styles.rankMain}>
        <Text style={styles.rankName} numberOfLines={1}>
          {entry.username}
          {isMe ? ' (du)' : ''}
        </Text>
        <Text style={styles.rankSub}>
          Level {level.level} · {level.name}
        </Text>
      </View>
      <Text style={styles.rankValue}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', paddingTop: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  me: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexShrink: 1,
  },
  meText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  info: { color: colors.accent, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  requestsCard: { borderColor: colors.accent },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  requestName: { color: colors.text, fontSize: 15, flex: 1 },
  requestButtons: { flexDirection: 'row', gap: spacing.sm },
  cancel: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rankRowMe: { backgroundColor: colors.surfaceRaised },
  pressed: { opacity: 0.7 },
  place: { width: 30, color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  avatar: { fontSize: 24 },
  rankMain: { flex: 1, gap: 2 },
  rankName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rankSub: { color: colors.textMuted, fontSize: 12 },
  rankValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
});

import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/TextField';
import { colors, radius, spacing } from '../../components/theme';
import { friendlyError } from '../../lib/errors';
import { formatDuration, formatEuro, parseAmount } from '../../lib/format';
import { activeGoals, availableHours, goalProgress, goalRole, myLastContribution } from '../../lib/goalMath';
import type { Goal } from '../../lib/goals';
import { totalSavedHours } from '../../lib/stats';
import { useApp } from '../../state/AppProvider';
import { useGoals } from '../../state/GoalsProvider';
import { useItems } from '../../state/ItemsProvider';

/** Auf ganze Hundertstel abrunden, damit der Server nie "zu viel" sieht. */
const floor2 = (n: number) => Math.floor(n * 100) / 100;

export default function Goals() {
  const { items } = useItems();
  const { session } = useApp();
  const myId = session?.user.id ?? null;
  const {
    goals,
    loading,
    errorMessage,
    reload,
    deleteGoal,
    addContribution,
    undoLastContribution,
    respondInvite,
    leave,
  } = useGoals();
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);

  const available = useMemo(() => floor2(availableHours(totalSavedHours(items), goals, myId)), [items, goals, myId]);
  const active = useMemo(() => activeGoals(goals, myId), [goals, myId]);
  const invitations = goals.filter((g) => goalRole(g, myId) === 'invited');

  const run = (action: () => Promise<void>) =>
    action().catch((e) => Alert.alert('Das hat nicht geklappt', friendlyError(e)));

  const onMore = (goal: Goal) => {
    const role = goalRole(goal, myId);
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    const last = myLastContribution(goal, myId);
    if (last) {
      buttons.push({
        text: `Meine letzten ${formatDuration(last.hours)} zurücknehmen`,
        onPress: () => run(() => undoLastContribution(goal.id)),
      });
    }
    if (role === 'owner') {
      buttons.push({
        text: 'Ziel löschen',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Ziel löschen?',
            goal.isShared
              ? 'Das Ziel wird für alle Mitglieder gelöscht. Alle zugeordneten Stunden werden wieder frei.'
              : 'Die zugeordneten Stunden werden wieder frei.',
            [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Löschen', style: 'destructive', onPress: () => run(() => deleteGoal(goal.id)) },
            ],
          ),
      });
    } else if (role === 'member') {
      buttons.push({
        text: 'Ziel verlassen',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Ziel verlassen?', 'Deine Stunden werden wieder frei.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Verlassen', style: 'destructive', onPress: () => run(() => leave(goal.id)) },
          ]),
      });
    }
    buttons.push({ text: 'Abbrechen', style: 'cancel' });
    // Höchstens 3 Knöpfe – mehr zeigt Android nicht an.
    Alert.alert(`${goal.emoji ?? '⭐'} ${goal.name}`, undefined, buttons);
  };

  if (loading && goals.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (errorMessage && goals.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.empty}>{errorMessage}</Text>
        <View style={styles.stretch}>
          <Button title="Erneut versuchen" onPress={reload} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={active}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshing={loading}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Sparziele</Text>
            <Card style={available > 0 ? styles.availableCard : undefined}>
              <Text style={styles.availableLabel}>Gesparte Stunden zum Verteilen</Text>
              <Text style={[styles.availableValue, available > 0 && styles.accentText]}>
                {formatDuration(Math.max(0, available))}
              </Text>
              {available <= 0 ? (
                <Text style={styles.muted}>
                  Tippe im Rechner auf „Nicht gekauft“, um Stunden zu sparen, und verteile sie hier
                  auf deine Ziele.
                </Text>
              ) : null}
            </Card>

            {invitations.map((g) => {
              const owner = g.members.find((m) => m.userId === g.ownerId);
              return (
                <Card key={g.id} style={styles.inviteCard}>
                  <Text style={styles.inviteTitle}>
                    {owner?.avatarEmoji ?? '🙂'} {owner?.username ?? 'Jemand'} lädt dich ein
                  </Text>
                  <Text style={styles.muted}>
                    {g.emoji ?? '⭐'} {g.name} · gemeinsam {formatDuration(g.targetHours)} sparen
                  </Text>
                  <View style={styles.inviteButtons}>
                    <View style={styles.flex}>
                      <Button title="Mitmachen" onPress={() => run(() => respondInvite(g.id, true))} />
                    </View>
                    <View style={styles.flex}>
                      <Button title="Ablehnen" variant="secondary" onPress={() => run(() => respondInvite(g.id, false))} />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Noch keine Ziele. Wofür würdest du gern sparen?</Text>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Link href="/ziel-neu" asChild>
              <Pressable style={styles.addButton} accessibilityRole="button">
                <Text style={styles.addText}>＋ Neues Ziel</Text>
              </Pressable>
            </Link>
          </View>
        }
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            myId={myId}
            available={available}
            open={openGoalId === item.id}
            onToggle={() => setOpenGoalId((id) => (id === item.id ? null : item.id))}
            onAllocate={async (hours) => {
              await addContribution(item.id, hours);
              setOpenGoalId(null);
            }}
            onMore={() => onMore(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

type CardProps = {
  goal: Goal;
  myId: string | null;
  available: number;
  open: boolean;
  onToggle: () => void;
  onAllocate: (hours: number) => Promise<void>;
  onMore: () => void;
};

function GoalCard({ goal, myId, available, open, onToggle, onAllocate, onMore }: CardProps) {
  const isOwner = goal.ownerId === myId;
  const progress = goalProgress(goal);
  const reached = progress >= 1;
  const missing = floor2(Math.max(0, goal.targetHours - goal.allocatedHours));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const quick = [1, 5].filter((h) => h <= available);
  const allValue = floor2(Math.min(available, missing));

  const submit = async (hours: number) => {
    if (!(hours > 0)) {
      setError('Bitte eine Stundenzahl größer als 0 eingeben.');
      return;
    }
    if (hours > available + 0.001) {
      setError(`Du hast nur ${formatDuration(available)} zum Verteilen.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onAllocate(floor2(hours));
      setAmount('');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, reached && styles.cardReached]}>
      <View style={styles.cardTop}>
        <Text style={styles.emoji}>{goal.emoji ?? '⭐'}</Text>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.muted}>
            {goal.isShared
              ? `👥 Gemeinsam · Ziel ${formatDuration(goal.targetHours)}`
              : `${formatEuro(goal.targetPrice ?? 0)} · ${formatDuration(goal.targetHours)} Arbeit`}
          </Text>
        </View>
        <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel="Weitere Optionen" hitSlop={10}>
          <Text style={styles.more}>•••</Text>
        </Pressable>
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {formatDuration(goal.allocatedHours)} von {formatDuration(goal.targetHours)}
        </Text>
        <Text style={styles.progressPercent}>{Math.floor(progress * 100)} %</Text>
      </View>

      {goal.isShared ? (
        <View style={styles.members}>
          {goal.members
            .slice()
            .sort((a, b) => b.hours - a.hours)
            .map((m) => (
              <View key={m.userId} style={styles.memberRow}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.avatarEmoji ?? '🙂'} {m.username ?? 'Unbekannt'}
                  {m.userId === myId ? ' (du)' : ''}
                </Text>
                <Text style={styles.memberHours}>
                  {m.status === 'invited' ? 'eingeladen' : formatDuration(m.hours)}
                </Text>
              </View>
            ))}
          {isOwner ? (
            <Pressable onPress={() => router.push(`/ziel-einladen/${goal.id}`)} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.inviteLink}>＋ Freunde einladen</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {reached ? (
        <Text style={styles.reached}>🎉 Ziel erreicht! Du hast es dir verdient.</Text>
      ) : available > 0 ? (
        open ? (
          <View style={styles.allocate}>
            <View style={styles.chips}>
              {quick.map((h) => (
                <Pressable key={h} style={styles.chip} onPress={() => submit(h)} disabled={saving}>
                  <Text style={styles.chipText}>+{h} Std.</Text>
                </Pressable>
              ))}
              {allValue > 0 ? (
                <Pressable style={styles.chip} onPress={() => submit(allValue)} disabled={saving}>
                  <Text style={styles.chipText}>
                    {allValue < available ? 'Rest bis zum Ziel' : 'Alles'} ({formatDuration(allValue)})
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <TextField
              label="Eigene Stundenzahl"
              placeholder="z. B. 2,5"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              suffix="Std."
              error={error}
            />
            <Button
              title="Zuordnen"
              onPress={() => submit(parseAmount(amount) ?? 0)}
              loading={saving}
            />
          </View>
        ) : (
          <Button title="＋ Stunden zuordnen" variant="secondary" onPress={onToggle} />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  stretch: { alignSelf: 'stretch' },
  list: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { gap: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', paddingTop: spacing.sm },
  availableCard: { borderColor: colors.accent },
  availableLabel: { color: colors.textMuted, fontSize: 13 },
  availableValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  accentText: { color: colors.accent },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: spacing.md },
  footer: { marginTop: spacing.sm },
  addButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardReached: { borderColor: colors.accent },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 28 },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  more: { color: colors.textMuted, fontSize: 16, letterSpacing: 1, paddingHorizontal: spacing.xs },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.chartSaved },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: colors.text, fontSize: 14 },
  progressPercent: { color: colors.text, fontSize: 14, fontWeight: '700' },
  reached: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  allocate: { gap: spacing.md, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  members: { gap: 6, paddingTop: spacing.xs },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  memberName: { color: colors.text, fontSize: 14, flex: 1 },
  memberHours: { color: colors.textMuted, fontSize: 14 },
  inviteLink: { color: colors.accent, fontSize: 14, fontWeight: '700', paddingTop: 4 },
  inviteCard: { borderColor: colors.accent },
  inviteTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  inviteButtons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});

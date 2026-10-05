import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { colors, spacing } from '../../components/theme';
import { friendlyError } from '../../lib/errors';
import { SHARED_GOAL_MAX_MEMBERS } from '../../lib/goals';
import { useApp } from '../../state/AppProvider';
import { useFriends } from '../../state/FriendsProvider';
import { useGoals } from '../../state/GoalsProvider';

/** Freunde zu einem gemeinsamen Ziel einladen (nur Ersteller). */
export default function InviteToGoal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useApp();
  const { goals, invite } = useGoals();
  const { entries } = useFriends();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goal = goals.find((g) => g.id === id);
  if (!goal || !goal.isShared || goal.ownerId !== session?.user.id) {
    return (
      <Screen edges={['bottom']}>
        <Text style={styles.muted}>Dieses Ziel gibt es nicht (mehr), oder du hast es nicht angelegt.</Text>
        <Button title="Zurück" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const memberIds = new Set(goal.members.map((m) => m.userId));
  const friends = entries.filter((e) => e.relation === 'friend');
  const full = goal.members.length >= SHARED_GOAL_MAX_MEMBERS;

  const onInvite = async (userId: string) => {
    setError(null);
    setBusyId(userId);
    try {
      await invite(goal.id, userId);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={styles.intro}>
        {goal.emoji ?? '⭐'} {goal.name}: Wen möchtest du einladen? ({goal.members.length}/{SHARED_GOAL_MAX_MEMBERS} Plätze)
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {friends.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Du hast noch keine Freunde. Füge zuerst im Tab „Freunde“ jemanden hinzu.</Text>
        </Card>
      ) : (
        <Card>
          {friends.map((f) => {
            const member = goal.members.find((m) => m.userId === f.userId);
            return (
              <View key={f.userId} style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {f.avatarEmoji ?? '🙂'} {f.username}
                </Text>
                {memberIds.has(f.userId) ? (
                  <Text style={styles.muted}>{member?.status === 'invited' ? 'eingeladen ✉️' : 'dabei ✓'}</Text>
                ) : (
                  <View style={styles.button}>
                    <Button
                      title="Einladen"
                      variant="secondary"
                      onPress={() => onInvite(f.userId)}
                      loading={busyId === f.userId}
                      disabled={full || busyId !== null}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      )}
      <Button title="Fertig" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 4 },
  name: { color: colors.text, fontSize: 15, flex: 1 },
  button: { minWidth: 120 },
});

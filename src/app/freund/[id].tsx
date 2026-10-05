import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BadgeGrid } from '../../components/Achievements';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatTile } from '../../components/charts';
import { Screen } from '../../components/Screen';
import { colors, spacing } from '../../components/theme';
import { badgeStatuses, levelFor } from '../../lib/achievements';
import { friendlyError } from '../../lib/errors';
import { formatDuration } from '../../lib/format';
import { useFriends } from '../../state/FriendsProvider';

function days(n: number): string {
  return `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
}

/** Profil eines Freundes – nur die vom Server freigegebenen Kennzahlen. */
export default function FriendProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, remove } = useFriends();
  const friend = entries.find((e) => e.userId === id && e.relation === 'friend');

  if (!friend || !friend.stats) {
    return (
      <Screen edges={['bottom']}>
        <Text style={styles.muted}>Dieses Profil ist nicht (mehr) verfügbar.</Text>
        <Button title="Zurück" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const s = friend.stats;
  const level = levelFor(s.savedHours);
  const badges = badgeStatuses({
    savedHours: s.savedHours,
    skipCount: s.skipCount,
    patientSkipCount: s.patientSkipCount,
    bestStreak: s.bestStreak,
    goalsReached: s.goalsReached,
  });
  const unlocked = badges.filter((b) => b.unlocked).length;

  const onRemove = () => {
    Alert.alert('Freundschaft beenden?', `${friend.username} wird aus deiner Freundesliste entfernt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Beenden',
        style: 'destructive',
        onPress: () => {
          remove(friend.friendshipId as string)
            .then(() => router.back())
            .catch((e) => Alert.alert('Das hat nicht geklappt', friendlyError(e)));
        },
      },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: friend.username ?? 'Freund' }} />
      <View style={styles.hero}>
        <Text style={styles.avatar}>{friend.avatarEmoji ?? '🙂'}</Text>
        <Text style={styles.name}>{friend.username}</Text>
        <Text style={styles.level}>
          Level {level.level} · {level.name}
        </Text>
      </View>

      <View style={styles.tiles}>
        <StatTile label="Diese Woche (Rangliste)" value={formatDuration(s.weekHours)} highlight />
        <StatTile label="Sparserie" value={`🔥 ${days(s.currentStreak)}`} sub={`Rekord: ${days(s.bestStreak)}`} />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Insgesamt gespart" value={formatDuration(s.savedHours)} />
        <StatTile label="Widerstanden" value={`${s.skipCount}×`} sub={`${s.goalsReached} Ziel(e) erreicht`} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>
          Abzeichen ({unlocked}/{badges.length})
        </Text>
        <BadgeGrid statuses={badges} />
      </Card>

      <Button title="Freundschaft beenden" variant="danger" onPress={onRemove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  avatar: { fontSize: 56 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  level: { color: colors.textMuted, fontSize: 15 },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 15 },
});

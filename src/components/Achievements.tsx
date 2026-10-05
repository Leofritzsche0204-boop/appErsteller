import { StyleSheet, Text, View } from 'react-native';

import type { BadgeStatus, LevelInfo, Streak } from '../lib/achievements';
import { formatDuration } from '../lib/format';
import { colors, radius, spacing } from './theme';

function days(n: number): string {
  return `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
}

/** Sparserie und Level nebeneinander. */
export function StreakLevelCard({ streak, level }: { streak: Streak; level: LevelInfo }) {
  return (
    <View style={styles.row}>
      <View style={styles.box} accessible accessibilityLabel={`Sparserie: ${days(streak.current)} ohne Impulskauf`}>
        <Text style={styles.big}>🔥 {days(streak.current)}</Text>
        <Text style={styles.label}>ohne Impulskauf</Text>
        <Text style={styles.sub}>Rekord: {days(streak.best)}</Text>
      </View>
      <View style={styles.box} accessible accessibilityLabel={`Level ${level.level}: ${level.name}`}>
        <Text style={styles.big}>Level {level.level}</Text>
        <Text style={styles.label}>{level.name}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${level.progress * 100}%` }]} />
        </View>
        <Text style={styles.sub}>
          {level.hoursToNext == null ? 'Höchstes Level erreicht 👑' : `noch ${formatDuration(level.hoursToNext)} sparen`}
        </Text>
      </View>
    </View>
  );
}

/** Alle Abzeichen als Raster; gesperrte grau mit Fortschritt. */
export function BadgeGrid({ statuses }: { statuses: BadgeStatus[] }) {
  return (
    <View style={styles.grid}>
      {statuses.map(({ badge, unlocked, progress }) => (
        <View
          key={badge.id}
          style={[styles.badge, unlocked && styles.badgeUnlocked]}
          accessible
          accessibilityLabel={`${badge.title}: ${badge.description}. ${unlocked ? 'Freigeschaltet' : `${Math.floor(progress * 100)} Prozent`}`}
        >
          <Text style={[styles.badgeIcon, !unlocked && styles.locked]}>{badge.icon}</Text>
          <Text style={[styles.badgeTitle, !unlocked && styles.lockedText]} numberOfLines={2}>
            {badge.title}
          </Text>
          <Text style={styles.badgeDesc} numberOfLines={3}>
            {badge.description}
          </Text>
          {!unlocked ? (
            <View style={styles.badgeTrack}>
              <View style={[styles.badgeFill, { width: `${progress * 100}%` }]} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  big: { color: colors.text, fontSize: 20, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 13 },
  sub: { color: colors.textMuted, fontSize: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.chartSaved },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  badgeUnlocked: { borderColor: colors.accent },
  badgeIcon: { fontSize: 28 },
  locked: { opacity: 0.3 },
  badgeTitle: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  lockedText: { color: colors.textMuted },
  badgeDesc: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  badgeTrack: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  badgeFill: { height: '100%', backgroundColor: colors.chartSaved },
});

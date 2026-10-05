import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BadgeGrid, StreakLevelCard } from '../../components/Achievements';
import { Card } from '../../components/Card';
import { BudgetMeter, CategoryBars, MonthBars, StatTile } from '../../components/charts';
import { Screen } from '../../components/Screen';
import { colors, spacing } from '../../components/theme';
import { formatDuration } from '../../lib/format';
import { budgetStatus, categorySpent, monthSummary, monthlyTotals, totalSavedHours } from '../../lib/stats';
import { useApp } from '../../state/AppProvider';
import { useItems } from '../../state/ItemsProvider';
import { useAchievements } from '../../state/useAchievements';

export default function Statistics() {
  const { profile } = useApp();
  const { items } = useItems();
  const { streak, level, badges } = useAchievements();
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const stats = useMemo(() => {
    const now = new Date();
    const month = monthSummary(items, now);
    return {
      month,
      months: monthlyTotals(items, now, 6),
      categories: categorySpent(items, now),
      totalSaved: totalSavedHours(items),
      budget: budgetStatus(month.spentHours, profile?.monthlyBudgetHours ?? null),
    };
  }, [items, profile?.monthlyBudgetHours]);

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>Statistik</Text>

      <StreakLevelCard streak={streak} level={level} />

      <View style={styles.tiles}>
        <StatTile
          label="Diesen Monat gespart"
          value={formatDuration(stats.month.savedHours)}
          sub={`${stats.month.savedCount}× widerstanden`}
          highlight
        />
        <StatTile
          label="Insgesamt gespart"
          value={formatDuration(stats.totalSaved)}
          sub="seit Beginn"
        />
      </View>

      <Card>
        {stats.budget ? (
          <BudgetMeter status={stats.budget} />
        ) : (
          <View style={styles.noBudget}>
            <Text style={styles.cardTitle}>Monatsbudget</Text>
            <Text style={styles.muted}>
              Lege fest, wie viele Arbeitsstunden du pro Monat höchstens für Käufe ausgeben willst.
            </Text>
            <Link href="/einstellungen" style={styles.link}>
              Budget festlegen →
            </Link>
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Letzte 6 Monate</Text>
        <MonthBars months={stats.months} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Gekauft nach Kategorie</Text>
        <Text style={styles.muted}>Diesen Monat, in Arbeitsstunden</Text>
        <CategoryBars totals={stats.categories} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>
          Abzeichen ({unlockedCount}/{badges.length})
        </Text>
        <BadgeGrid statuses={badges} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '800', paddingTop: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  noBudget: { gap: spacing.sm },
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});

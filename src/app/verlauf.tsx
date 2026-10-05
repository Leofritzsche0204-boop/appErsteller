import { useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, radius, spacing } from '../components/theme';
import { friendlyError } from '../lib/errors';
import { formatDuration, formatEuro } from '../lib/format';
import { categoryInfo } from '../lib/items';
import type { Item } from '../lib/items';
import { monthSummary } from '../lib/stats';
import { useItems } from '../state/ItemsProvider';

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_LABEL: Record<Item['status'], string> = {
  skipped: 'Nicht gekauft',
  bought: 'Gekauft',
  wishlist: 'Wunschliste',
};

export default function History() {
  const { items, loading, errorMessage, reload, updateItemStatus, deleteItem } = useItems();
  const summary = useMemo(() => monthSummary(items), [items]);
  // Wünsche mit laufender Bedenkzeit stehen auf der Wunschliste, nicht im Verlauf.
  const decided = useMemo(() => items.filter((i) => i.status !== 'wishlist'), [items]);

  const onItemPress = (item: Item) => {
    const name = item.title ?? categoryInfo(item.category)?.label ?? 'Eintrag';
    const run = (action: () => Promise<void>) => {
      action().catch((e) => Alert.alert('Das hat nicht geklappt', friendlyError(e)));
    };
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (item.status === 'bought') {
      buttons.push({ text: 'Doch nicht gekauft', onPress: () => run(() => updateItemStatus(item.id, 'skipped')) });
    } else if (item.status === 'skipped') {
      buttons.push({ text: 'Doch gekauft', onPress: () => run(() => updateItemStatus(item.id, 'bought')) });
    }
    buttons.push({
      text: 'Löschen',
      style: 'destructive',
      onPress: () => run(() => deleteItem(item.id)),
    });
    buttons.push({ text: 'Abbrechen', style: 'cancel' });
    Alert.alert(name, `${formatEuro(item.price)} · ${formatDuration(item.hours)}`, buttons);
  };

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, styles.summarySaved]}>
          <Text style={styles.summaryLabel}>Diesen Monat gespart</Text>
          <Text style={[styles.summaryValue, styles.savedText]}>{formatDuration(summary.savedHours)}</Text>
          <Text style={styles.summaryCount}>{summary.savedCount}× widerstanden</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Diesen Monat gekauft</Text>
          <Text style={styles.summaryValue}>{formatDuration(summary.spentHours)}</Text>
          <Text style={styles.summaryCount}>{summary.boughtCount}× gekauft</Text>
        </Card>
      </View>
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (errorMessage && items.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <Text style={styles.empty}>{errorMessage}</Text>
        <View style={styles.retry}>
          <Button title="Erneut versuchen" onPress={reload} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={decided}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Noch keine Einträge. Prüfe im Rechner einen Preis und tippe auf „Nicht gekauft“ oder
            „Gekauft“.
          </Text>
        }
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => <HistoryRow item={item} onPress={() => onItemPress(item)} />}
      />
    </SafeAreaView>
  );
}

function HistoryRow({ item, onPress }: { item: Item; onPress: () => void }) {
  const cat = categoryInfo(item.category);
  const name = item.title ?? cat?.label ?? 'Ohne Namen';
  const date = dateFormatter.format(new Date(item.decidedAt ?? item.createdAt));
  const tone =
    item.status === 'skipped' ? styles.badgeSaved : item.status === 'bought' ? styles.badgeBought : styles.badgeWish;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Optionen anzeigen"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.rowIcon}>{cat?.icon ?? '🧾'}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta}>
          {formatEuro(item.price)} · {date}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowHours}>{formatDuration(item.hours)}</Text>
        <Text style={[styles.badge, tone]}>{STATUS_LABEL[item.status]}</Text>
      </View>
    </Pressable>
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
  retry: { alignSelf: 'stretch' },
  list: { padding: spacing.lg, gap: spacing.sm, width: '100%', maxWidth: 560, alignSelf: 'center' },
  headerWrap: { gap: spacing.md, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryCard: { flex: 1, gap: 2 },
  summarySaved: { borderColor: colors.accent },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  savedText: { color: colors.accent },
  summaryCount: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: { fontSize: 22 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 13 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowHours: { color: colors.text, fontSize: 15, fontWeight: '700' },
  badge: { fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeSaved: { color: colors.accentText, backgroundColor: colors.accent },
  badgeBought: { color: colors.text, backgroundColor: colors.surfaceRaised },
  badgeWish: { color: colors.accentText, backgroundColor: colors.warning },
});

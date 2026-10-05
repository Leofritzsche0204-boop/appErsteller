import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { colors, radius, spacing } from '../../components/theme';
import { friendlyError } from '../../lib/errors';
import { formatDuration, formatEuro } from '../../lib/format';
import { categoryInfo } from '../../lib/items';
import type { Item } from '../../lib/items';
import { useNow } from '../../lib/useNow';
import { cooldownProgress, formatRemaining, remainingMs } from '../../lib/wishlist';
import { useItems } from '../../state/ItemsProvider';

export default function Wishlist() {
  const { items, loading, errorMessage, reload, updateItemStatus, deleteItem } = useItems();
  const now = useNow();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Abgelaufene Bedenkzeit zuerst, dann nach verbleibender Zeit sortiert.
  const wishlist = useMemo(
    () =>
      items
        .filter((i) => i.status === 'wishlist')
        .sort((a, b) => remainingMs(a, now) - remainingMs(b, now)),
    [items, now],
  );

  const decide = async (item: Item, status: 'bought' | 'skipped') => {
    setBusyId(item.id);
    try {
      await updateItemStatus(item.id, status);
      if (status === 'skipped') {
        Alert.alert('💪 Stark!', `Du hast dir ${formatDuration(item.hours)} Arbeit gespart.`);
      }
    } catch (e) {
      Alert.alert('Das hat nicht geklappt', friendlyError(e));
    } finally {
      setBusyId(null);
    }
  };

  const decideEarly = (item: Item) => {
    Alert.alert(
      'Bedenkzeit läuft noch',
      `${formatRemaining(remainingMs(item, now))}. Wenn du jetzt schon entscheidest, zählt ein Verzicht nicht für die Rangliste.`,
      [
        { text: 'Nicht gekauft', onPress: () => decide(item, 'skipped') },
        { text: 'Gekauft', onPress: () => decide(item, 'bought') },
        { text: 'Weiter warten', style: 'cancel' },
      ],
    );
  };

  const confirmDelete = (item: Item) => {
    Alert.alert('Eintrag löschen?', 'Er wird von der Wunschliste entfernt und nicht gezählt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => {
          deleteItem(item.id).catch((e) => Alert.alert('Das hat nicht geklappt', friendlyError(e)));
        },
      },
    ]);
  };

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (errorMessage && items.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.empty}>{errorMessage}</Text>
        <View style={styles.retry}>
          <Button title="Erneut versuchen" onPress={reload} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={wishlist}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Wunschliste</Text>
            <Text style={styles.intro}>
              Schlaf eine Nacht drüber. Nach 24 Stunden entscheidest du nochmal, ob du es wirklich
              willst. Verzichtest du dann, zählt das auch für die Rangliste.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Deine Wunschliste ist leer. Tippe im Rechner auf „Auf die Wunschliste“, wenn du dir
            unsicher bist.
          </Text>
        }
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <WishCard
            item={item}
            remaining={remainingMs(item, now)}
            busy={busyId === item.id}
            onSkip={() => decide(item, 'skipped')}
            onBuy={() => decide(item, 'bought')}
            onDecideEarly={() => decideEarly(item)}
            onDelete={() => confirmDelete(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

type CardProps = {
  item: Item;
  remaining: number;
  busy: boolean;
  onSkip: () => void;
  onBuy: () => void;
  onDecideEarly: () => void;
  onDelete: () => void;
};

function WishCard({ item, remaining, busy, onSkip, onBuy, onDecideEarly, onDelete }: CardProps) {
  const cat = categoryInfo(item.category);
  const name = item.title ?? cat?.label ?? 'Ohne Namen';
  const ready = remaining === 0;
  const progress = cooldownProgress(remaining);

  return (
    <View style={[styles.card, ready && styles.cardReady]}>
      <View style={styles.cardTop}>
        <Text style={styles.icon}>{cat?.icon ?? '🧾'}</Text>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.cardMeta}>
            {formatEuro(item.price)} · {formatDuration(item.hours)} Arbeit
          </Text>
        </View>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`${name} löschen`}
          hitSlop={10}
          disabled={busy}
        >
          <Text style={styles.delete}>✕</Text>
        </Pressable>
      </View>

      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <View style={[styles.progressFill, { width: `${progress * 100}%` }, ready && styles.progressReady]} />
      </View>

      {ready ? (
        <>
          <Text style={styles.readyText}>⏰ Bedenkzeit vorbei. Willst du es immer noch?</Text>
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button title="Nicht gekauft 💪" onPress={onSkip} loading={busy} />
            </View>
            <View style={styles.flex}>
              <Button title="Gekauft" variant="secondary" onPress={onBuy} disabled={busy} />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.waitingRow}>
          <Text style={styles.remaining}>⏳ {formatRemaining(remaining)}</Text>
          <Pressable onPress={onDecideEarly} disabled={busy} hitSlop={8} accessibilityRole="button">
            <Text style={styles.earlyLink}>{busy ? '…' : 'Jetzt entscheiden'}</Text>
          </Pressable>
        </View>
      )}
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
  retry: { alignSelf: 'stretch' },
  list: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  headerWrap: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', paddingTop: spacing.sm },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  empty: { color: colors.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardReady: { borderColor: colors.warning },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { fontSize: 24 },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 14 },
  delete: { color: colors.textMuted, fontSize: 16, paddingHorizontal: spacing.xs },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.textMuted },
  progressReady: { backgroundColor: colors.warning },
  readyText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  waitingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remaining: { color: colors.textMuted, fontSize: 14 },
  earlyLink: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
});

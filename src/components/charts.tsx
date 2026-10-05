// Einfache Diagramme aus Views – ohne zusätzliche Bibliothek.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '../lib/format';
import { categoryInfo } from '../lib/items';
import type { BudgetStatus, CategoryTotal, MonthTotals } from '../lib/stats';
import { colors, radius, spacing } from './theme';

// ---------------------------------------------------------------------------
// Kennzahl-Kachel
// ---------------------------------------------------------------------------
export function StatTile({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <View style={[styles.tile, highlight && styles.tileHighlight]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, highlight && styles.tileValueHighlight]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Budget-Anzeige (Verbrauch gegen Grenze)
// ---------------------------------------------------------------------------
export function BudgetMeter({ status }: { status: BudgetStatus }) {
  const fill = Math.min(1, status.ratio);
  const tone = status.level === 'over' ? colors.danger : status.level === 'warning' ? colors.warning : colors.chartSaved;
  const message =
    status.level === 'over'
      ? `⛔ ${formatDuration(-status.remaining)} über deinem Budget`
      : status.level === 'warning'
        ? `⚠️ Nur noch ${formatDuration(status.remaining)} übrig`
        : `Noch ${formatDuration(status.remaining)} übrig`;

  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterHead}>
        <Text style={styles.meterTitle}>Monatsbudget</Text>
        <Text style={styles.meterValue}>
          {formatDuration(status.spent)} von {formatDuration(status.budget)}
        </Text>
      </View>
      <View
        style={styles.meterTrack}
        accessibilityRole="progressbar"
        accessibilityLabel="Monatsbudget verbraucht"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100) }}
      >
        <View style={[styles.meterFill, { width: `${fill * 100}%`, backgroundColor: tone }]} />
      </View>
      <Text style={styles.meterMessage}>{message}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Monatsverlauf: gespart vs. gekauft, Monat antippen für Details
// ---------------------------------------------------------------------------
const CHART_HEIGHT = 140;

export function MonthBars({ months }: { months: MonthTotals[] }) {
  const [selectedKey, setSelectedKey] = useState(months[months.length - 1]?.key);
  const selected = months.find((m) => m.key === selectedKey) ?? months[months.length - 1];
  const max = Math.max(1, ...months.map((m) => Math.max(m.savedHours, m.spentHours)));
  const isEmpty = months.every((m) => m.savedHours === 0 && m.spentHours === 0);

  return (
    <View style={styles.chartWrap}>
      <View style={styles.legend}>
        <LegendDot color={colors.chartSaved} label="Gespart" />
        <LegendDot color={colors.chartSpent} label="Gekauft" />
      </View>

      {selected ? (
        <Text style={styles.selectedText}>
          {selected.label}: {formatDuration(selected.savedHours)} gespart · {formatDuration(selected.spentHours)} gekauft
        </Text>
      ) : null}

      <View style={styles.barsArea}>
        {months.map((m) => {
          const active = m.key === selected?.key;
          return (
            <Pressable
              key={m.key}
              style={[styles.monthCol, active && styles.monthColActive]}
              onPress={() => setSelectedKey(m.key)}
              accessibilityRole="button"
              accessibilityLabel={`${m.label}: ${formatDuration(m.savedHours)} gespart, ${formatDuration(m.spentHours)} gekauft`}
            >
              <View style={styles.barPair}>
                <Bar value={m.savedHours} max={max} color={colors.chartSaved} />
                <Bar value={m.spentHours} max={max} color={colors.chartSpent} />
              </View>
              <Text style={[styles.monthLabel, active && styles.monthLabelActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {isEmpty ? <Text style={styles.chartEmpty}>Noch keine Daten – trag im Rechner deine erste Entscheidung ein.</Text> : null}
    </View>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  // Werte > 0 bleiben sichtbar (mindestens 3 px)
  const height = value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 0;
  return <View style={[styles.bar, { height, backgroundColor: color }]} />;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gekauft nach Kategorie (diesen Monat)
// ---------------------------------------------------------------------------
export function CategoryBars({ totals }: { totals: CategoryTotal[] }) {
  if (totals.length === 0) {
    return <Text style={styles.chartEmpty}>Diesen Monat noch nichts gekauft. 💪</Text>;
  }
  const max = Math.max(...totals.map((t) => t.hours));
  return (
    <View style={styles.catList}>
      {totals.map((t) => {
        const info = categoryInfo(t.category);
        const label = info ? `${info.icon} ${info.label}` : '🧾 Ohne Kategorie';
        return (
          <View key={t.category ?? 'none'} style={styles.catRow} accessible accessibilityLabel={`${label}: ${formatDuration(t.hours)}`}>
            <View style={styles.catHead}>
              <Text style={styles.catLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.catValue}>{formatDuration(t.hours)}</Text>
            </View>
            <View style={styles.catTrack}>
              <View style={[styles.catFill, { width: `${(t.hours / max) * 100}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  tileHighlight: { borderColor: colors.accent },
  tileLabel: { color: colors.textMuted, fontSize: 12 },
  tileValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  tileValueHighlight: { color: colors.accent },
  tileSub: { color: colors.textMuted, fontSize: 12 },

  meterWrap: { gap: spacing.sm },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  meterTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meterValue: { color: colors.textMuted, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  meterTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 5 },
  meterMessage: { color: colors.text, fontSize: 14 },

  chartWrap: { gap: spacing.sm },
  legend: { flexDirection: 'row', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textMuted, fontSize: 13 },
  selectedText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  barsArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingTop: spacing.sm,
  },
  monthCol: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 6, borderRadius: radius.md },
  monthColActive: { backgroundColor: colors.surfaceRaised },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: CHART_HEIGHT },
  bar: { width: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  monthLabel: { color: colors.textMuted, fontSize: 12 },
  monthLabelActive: { color: colors.text, fontWeight: '700' },
  chartEmpty: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },

  catList: { gap: spacing.md },
  catRow: { gap: 6 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  catLabel: { color: colors.text, fontSize: 14, flex: 1 },
  catValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  catTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 4, backgroundColor: colors.chartSpent },
});

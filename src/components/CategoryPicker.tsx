import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES } from '../lib/items';
import type { Category } from '../lib/items';
import { colors, spacing } from './theme';

type Props = {
  value: Category | null;
  onChange: (value: Category | null) => void;
};

/** Kategorie-Auswahl als Chips. Nochmal tippen hebt die Auswahl auf. */
export function CategoryPicker({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {CATEGORIES.map((c) => {
        const selected = c.value === value;
        return (
          <Pressable
            key={c.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? null : c.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>
              {c.icon} {c.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  text: { color: colors.textMuted, fontSize: 14 },
  textSelected: { color: colors.text, fontWeight: '600' },
});

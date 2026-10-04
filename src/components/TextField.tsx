import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, radius, spacing } from './theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Text rechts im Feld, z. B. "€" oder "Std." */
  suffix?: string;
  error?: string | null;
  hint?: string;
};

export function TextField({ label, suffix, error, hint, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, error ? styles.boxError : null]}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={label}
          {...inputProps}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  boxError: { borderColor: colors.danger },
  input: { flex: 1, color: colors.text, fontSize: 18, paddingVertical: 14 },
  suffix: { color: colors.textMuted, fontSize: 16, marginLeft: spacing.sm },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13 },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { friendlyError } from '../lib/errors';
import { AVATAR_EMOJIS, USERNAME_MAX, usernameProblem } from '../lib/username';
import { useApp } from '../state/AppProvider';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, radius, spacing } from './theme';

/** Benutzername und Emoji festlegen oder ändern. */
export function UsernameForm({ onSaved }: { onSaved?: () => void }) {
  const { profile, updateProfile } = useApp();
  const [name, setName] = useState(profile?.username ?? '');
  const [emoji, setEmoji] = useState<string>(profile?.avatarEmoji ?? AVATAR_EMOJIS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const problem = usernameProblem(name);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ username: name.trim(), avatarEmoji: emoji });
      onSaved?.();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.emojis} accessibilityRole="radiogroup">
        {AVATAR_EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            accessibilityRole="radio"
            accessibilityState={{ selected: emoji === e }}
            style={[styles.emoji, emoji === e && styles.emojiSelected]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <TextField
        label="Benutzername"
        placeholder="z. B. sparfuchs_leo"
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={USERNAME_MAX}
        error={error}
        hint="3–20 Zeichen: Buchstaben, Zahlen, _. Freunde finden dich darüber."
      />
      <Button title="Speichern" onPress={onSave} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emoji: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  emojiText: { fontSize: 24 },
});

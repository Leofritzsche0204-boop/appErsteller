import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { colors, spacing } from '../components/theme';
import { useApp } from '../state/AppProvider';

/** Startpunkt: lädt Konto und Profil und leitet dann weiter. */
export default function Index() {
  const { status, errorMessage, profile, retry } = useApp();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Time is Money</Text>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Hoppla</Text>
        <Text style={styles.message}>{errorMessage ?? 'Etwas ist schiefgelaufen.'}</Text>
        <View style={styles.button}>
          <Button title="Erneut versuchen" onPress={retry} />
        </View>
      </View>
    );
  }

  return <Redirect href={profile.onboardedAt ? '/rechner' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  message: { color: colors.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  button: { alignSelf: 'stretch', maxWidth: 400, width: '100%' },
});

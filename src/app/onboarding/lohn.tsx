import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { WageForm } from '../../components/WageForm';
import { colors } from '../../components/theme';

export default function OnboardingWage() {
  // Zeitpunkt einmal festlegen, damit er sich beim Neu-Rendern nicht ändert.
  const extraUpdate = useMemo(() => ({ onboardedAt: new Date().toISOString() }), []);

  return (
    <Screen edges={['bottom']}>
      <Text style={styles.intro}>
        Damit wir Preise in Arbeitszeit umrechnen können, brauchen wir deinen Lohn. Du kannst ihn
        später jederzeit ändern.
      </Text>
      <WageForm
        submitLabel="Fertig – zum Rechner"
        extraUpdate={extraUpdate}
        onSaved={() => {
          // Onboarding aus dem Verlauf entfernen, damit "Zurück" nicht dorthin führt.
          if (router.canDismiss()) router.dismissAll();
          router.replace('/rechner');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
});

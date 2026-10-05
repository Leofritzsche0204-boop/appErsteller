import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AccountSwitchWarning } from '../../components/AccountSwitchWarning';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors } from '../../components/theme';
import { isValidEmail, signIn } from '../../lib/account';
import { friendlyError } from '../../lib/errors';
import { useRestartApp } from '../../lib/useSwitchAccount';

export default function SignIn() {
  const restart = useRestartApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!isValidEmail(email) || password.length === 0) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      restart();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={styles.intro}>Melde dich mit dem Konto an, das du in der App gesichert hast.</Text>
      <AccountSwitchWarning />
      <TextField
        label="E-Mail-Adresse"
        placeholder="name@beispiel.de"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
      />
      <TextField
        label="Passwort"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        error={error}
      />
      <Button title="Anmelden" onPress={onSubmit} loading={busy} />
      <Link href="/konto/passwort-vergessen" style={styles.link}>
        Passwort vergessen?
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
});

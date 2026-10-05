import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AccountSwitchWarning } from '../../components/AccountSwitchWarning';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors } from '../../components/theme';
import {
  cleanCode,
  confirmPasswordResetCode,
  isValidEmail,
  passwordProblem,
  requestPasswordReset,
  setPassword,
} from '../../lib/account';
import { UserFacingError, friendlyError } from '../../lib/errors';
import { useRestartApp } from '../../lib/useSwitchAccount';

type Step = 'email' | 'code' | 'password';

export default function ForgotPassword() {
  const restart = useRestartApp();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPw] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      if (!isValidEmail(email)) throw new UserFacingError('Bitte eine gültige E-Mail-Adresse eingeben.');
      await requestPasswordReset(email);
      setStep('code');
    });

  const verify = () =>
    run(async () => {
      if (cleanCode(code).length < 6) throw new UserFacingError('Bitte den Code aus der E-Mail eingeben.');
      await confirmPasswordResetCode(email, code);
      setStep('password');
    });

  const save = () =>
    run(async () => {
      const problem = passwordProblem(password, repeat);
      if (problem) throw new UserFacingError(problem);
      await setPassword(password);
      restart();
    });

  return (
    <Screen edges={['bottom']}>
      {step === 'email' ? (
        <>
          <Text style={styles.intro}>
            Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Code, mit dem du ein neues
            Passwort festlegen kannst.
          </Text>
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
          <Button title="Code senden" onPress={send} loading={busy} />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <Text style={styles.intro}>
            Falls es ein Konto mit {email.trim()} gibt, ist jetzt eine E-Mail mit einem Code unterwegs.
            Schau auch im Spam-Ordner nach.
          </Text>
          <TextField
            label="Code aus der E-Mail"
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
          />
          <Button title="Code bestätigen" onPress={verify} loading={busy} />
          <Button title="Neuen Code senden" variant="secondary" onPress={send} disabled={busy} />
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <Text style={styles.intro}>Leg dein neues Passwort fest.</Text>
          <TextField
            label="Neues Passwort"
            value={password}
            onChangeText={setPw}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            hint="Mindestens 8 Zeichen, Buchstaben und Zahlen."
          />
          <TextField
            label="Passwort wiederholen"
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Button title="Passwort speichern & anmelden" onPress={save} loading={busy} />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
});

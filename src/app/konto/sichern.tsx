import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, spacing } from '../../components/theme';
import {
  cleanCode,
  confirmEmailCode,
  isValidEmail,
  passwordProblem,
  refreshEmailStatus,
  requestEmailLink,
  setPassword,
} from '../../lib/account';
import { UserFacingError, friendlyError } from '../../lib/errors';
import { useApp } from '../../state/AppProvider';

type Step = 'email' | 'code' | 'password' | 'done';

/** Anonymes Konto mit E-Mail + Passwort sichern. */
export default function SecureAccount() {
  const { session } = useApp();
  const pending = session?.user.new_email ?? null;
  const [step, setStep] = useState<Step>(pending ? 'code' : 'email');
  const [email, setEmail] = useState(pending ?? '');
  const [code, setCode] = useState('');
  const [password, setPw] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      if (!isValidEmail(email)) throw new UserFacingError('Bitte eine gültige E-Mail-Adresse eingeben.');
      await requestEmailLink(email);
      setStep('code');
      setInfo(`Wir haben dir eine E-Mail an ${email.trim()} geschickt.`);
    });

  const verify = () =>
    run(async () => {
      if (cleanCode(code).length < 6) throw new UserFacingError('Bitte den Code aus der E-Mail eingeben.');
      await confirmEmailCode(email, code);
      setStep('password');
    });

  const checkLink = () =>
    run(async () => {
      const status = await refreshEmailStatus();
      if (status.email && !status.pendingEmail) {
        setStep('password');
      } else {
        setInfo('Noch nicht bestätigt. Gib den Code aus der E-Mail ein.');
      }
    });

  const savePassword = () =>
    run(async () => {
      const problem = passwordProblem(password, repeat);
      if (problem) throw new UserFacingError(problem);
      await setPassword(password);
      setStep('done');
    });

  return (
    <Screen edges={['bottom']}>
      {step === 'email' ? (
        <>
          <Text style={styles.intro}>
            Sichere dein Konto, damit deine Daten nicht verloren gehen, wenn du dein Handy wechselst
            oder die App neu installierst. Alles, was du bisher eingetragen hast, bleibt erhalten.
          </Text>
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
          <Button title="Bestätigungscode senden" onPress={sendCode} loading={busy} />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <Text style={styles.intro}>
            Wir haben eine E-Mail mit einem Code an <Text style={styles.bold}>{email}</Text> geschickt.
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
          <Button title="E-Mail erneut senden" variant="secondary" onPress={sendCode} disabled={busy} />
          <Button title="Andere E-Mail-Adresse" variant="secondary" onPress={() => setStep('email')} disabled={busy} />
          <Text style={styles.small} onPress={busy ? undefined : checkLink} accessibilityRole="button">
            Statt eines Codes kam ein Link? Darauf tippen und dann hier tippen.
          </Text>
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <Text style={styles.intro}>
            ✅ E-Mail bestätigt. Leg jetzt ein Passwort fest, damit du dich auf jedem Handy anmelden kannst.
          </Text>
          <TextField
            label="Passwort"
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
          <Button title="Passwort speichern" onPress={savePassword} loading={busy} />
        </>
      ) : null}

      {step === 'done' ? (
        <Card>
          <Text style={styles.doneTitle}>🔒 Konto gesichert!</Text>
          <Text style={styles.intro}>
            Du kannst dich ab jetzt auf jedem Handy mit {email || 'deiner E-Mail'} und deinem Passwort anmelden.
          </Text>
          <Button title="Fertig" onPress={() => router.back()} />
        </Card>
      ) : null}

      {info ? <Text style={styles.info}>{info}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  bold: { color: colors.text, fontWeight: '700' },
  info: { color: colors.text, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  small: { color: colors.textMuted, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
  doneTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.xs },
});

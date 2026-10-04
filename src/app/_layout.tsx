import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../components/theme';
import { AppProvider } from '../state/AppProvider';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <AppProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/lohn" options={{ title: 'Dein Lohn', headerBackTitle: 'Zurück' }} />
          <Stack.Screen name="rechner" options={{ headerShown: false }} />
          <Stack.Screen name="einstellungen" options={{ title: 'Einstellungen', headerBackTitle: 'Zurück' }} />
        </Stack>
      </AppProvider>
    </ThemeProvider>
  );
}

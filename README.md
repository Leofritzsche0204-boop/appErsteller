# Time is Money

Handy-App (iPhone + Android), die Preise in Arbeitszeit umrechnet.
Gebaut mit Expo / React Native + TypeScript, Daten in Supabase (EU, Frankfurt).

## Aufbau

```
src/app/           Screens (jede Datei = eine Seite, Expo Router)
  _layout.tsx      Navigation + App-Zustand
  index.tsx        Startpunkt: lädt Konto, leitet weiter
  onboarding/      Willkommen + Lohn einrichten
  rechner.tsx      Preis → Arbeitszeit
  einstellungen.tsx
src/components/    Wiederverwendbare Bausteine (Buttons, Felder, Formulare)
src/lib/           Logik: Rechnen, Formatieren, Supabase-Zugriff
src/state/         App-weiter Zustand (Anmeldung, Profil, Fixkosten)
supabase/migrations/  SQL für die Datenbank (im Supabase SQL Editor ausführen)
```

## App starten (Windows)

1. Einmalig: `npm install`
2. `npx expo start`
3. QR-Code mit dem iPhone (Kamera) bzw. in Expo Go (Android) scannen.

Handy und PC müssen im selben WLAN sein. Auf PC und Handy mit demselben Expo-Konto anmelden (`npx expo login`).

## Datenbank einrichten

Die Dateien in `supabase/migrations/` der Reihe nach im Supabase-Dashboard unter
**SQL Editor → New query** einfügen und **Run** klicken. Die Skripte können mehrfach ausgeführt werden.

## Prüfen

```bash
npx tsc --noEmit   # Typen prüfen
npx expo lint      # Code-Stil prüfen
```

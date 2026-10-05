import { router } from 'expo-router';
import { useCallback } from 'react';

import { useApp } from '../state/AppProvider';

/** Nach Anmelden/Abmelden/Löschen: alles neu laden und von vorn starten. */
export function useRestartApp() {
  const { retry } = useApp();
  return useCallback(() => {
    retry();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }, [retry]);
}

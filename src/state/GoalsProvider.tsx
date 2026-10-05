// Hält die Sparziele für die ganze App bereit.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { friendlyError } from '../lib/errors';
import {
  addContribution as apiAddContribution,
  createGoal as apiCreateGoal,
  deleteContribution as apiDeleteContribution,
  deleteGoal as apiDeleteGoal,
  fetchGoals,
} from '../lib/goals';
import type { Goal } from '../lib/goals';
import { useApp } from './AppProvider';

type GoalsState = {
  goals: Goal[];
  loading: boolean;
  errorMessage: string | null;
  reload: () => void;
  createGoal: (input: { name: string; emoji: string | null; targetPrice: number }) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  addContribution: (goalId: string, hours: number) => Promise<void>;
  undoLastContribution: (goalId: string) => Promise<void>;
};

const GoalsContext = createContext<GoalsState | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const { status, session } = useApp();
  const userId = session?.user.id ?? null;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadId = useRef(0);

  // State wird erst in den Callbacks gesetzt, wenn die Daten da sind.
  const load = useCallback(() => {
    const id = ++loadId.current;
    fetchGoals().then(
      (result) => {
        if (id !== loadId.current) return;
        setGoals(result);
        setErrorMessage(null);
        setLoading(false);
      },
      (error: unknown) => {
        if (id !== loadId.current) return;
        console.warn('Ziele laden fehlgeschlagen', error);
        setErrorMessage(friendlyError(error));
        setLoading(false);
      },
    );
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (status === 'ready' && userId) load();
  }, [status, userId, load]);

  const replaceGoal = (updated: Goal) => setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));

  const createGoal = useCallback(async (input: { name: string; emoji: string | null; targetPrice: number }) => {
    const created = await apiCreateGoal(input);
    setGoals((prev) => [...prev, created]);
    return created;
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await apiDeleteGoal(id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const addContribution = useCallback(async (goalId: string, hours: number) => {
    replaceGoal(await apiAddContribution(goalId, hours));
  }, []);

  const undoLastContribution = useCallback(
    async (goalId: string) => {
      const goal = goals.find((g) => g.id === goalId);
      const last = goal?.contributions[goal.contributions.length - 1];
      if (!last) return;
      replaceGoal(await apiDeleteContribution(goalId, last.id));
    },
    [goals],
  );

  const value = useMemo<GoalsState>(
    () => ({ goals, loading, errorMessage, reload, createGoal, deleteGoal, addContribution, undoLastContribution }),
    [goals, loading, errorMessage, reload, createGoal, deleteGoal, addContribution, undoLastContribution],
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals(): GoalsState {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals muss innerhalb von <GoalsProvider> verwendet werden');
  return ctx;
}

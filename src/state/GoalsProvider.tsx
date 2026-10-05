// Hält private und gemeinsame Sparziele für die ganze App bereit.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { friendlyError } from '../lib/errors';
import { myLastContribution } from '../lib/goalMath';
import {
  addContribution as apiAddContribution,
  createGoal as apiCreateGoal,
  deleteContribution as apiDeleteContribution,
  deleteGoal as apiDeleteGoal,
  fetchGoals,
  inviteToGoal as apiInvite,
  leaveGoal as apiLeave,
  respondGoalInvite as apiRespond,
} from '../lib/goals';
import type { Goal, NewGoal } from '../lib/goals';
import { useApp } from './AppProvider';

type GoalsState = {
  goals: Goal[];
  loading: boolean;
  errorMessage: string | null;
  reload: () => void;
  createGoal: (input: NewGoal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addContribution: (goalId: string, hours: number) => Promise<void>;
  undoLastContribution: (goalId: string) => Promise<void>;
  invite: (goalId: string, friendUserId: string) => Promise<void>;
  respondInvite: (goalId: string, accept: boolean) => Promise<void>;
  leave: (goalId: string) => Promise<void>;
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
    return fetchGoals().then(
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
    void load();
  }, [load]);

  useEffect(() => {
    if (status === 'ready' && userId) void load();
  }, [status, userId, load]);

  // Nach jeder Änderung neu laden – so stimmen auch die Stunden der anderen Mitglieder.
  const after = useCallback(
    async (action: () => Promise<void>) => {
      await action();
      await load();
    },
    [load],
  );

  const createGoal = useCallback((input: NewGoal) => after(() => apiCreateGoal(input)), [after]);
  const deleteGoal = useCallback((id: string) => after(() => apiDeleteGoal(id)), [after]);
  const addContribution = useCallback(
    (goalId: string, hours: number) => after(() => apiAddContribution(goalId, hours)),
    [after],
  );
  const invite = useCallback((goalId: string, friendId: string) => after(() => apiInvite(goalId, friendId)), [after]);
  const respondInvite = useCallback(
    (goalId: string, accept: boolean) => after(() => apiRespond(goalId, accept)),
    [after],
  );
  const leave = useCallback((goalId: string) => after(() => apiLeave(goalId)), [after]);

  const undoLastContribution = useCallback(
    async (goalId: string) => {
      const goal = goals.find((g) => g.id === goalId);
      const last = goal ? myLastContribution(goal, userId) : null;
      if (!last) return;
      await after(() => apiDeleteContribution(last.id));
    },
    [goals, userId, after],
  );

  const value = useMemo<GoalsState>(
    () => ({
      goals,
      loading,
      errorMessage,
      reload,
      createGoal,
      deleteGoal,
      addContribution,
      undoLastContribution,
      invite,
      respondInvite,
      leave,
    }),
    [goals, loading, errorMessage, reload, createGoal, deleteGoal, addContribution, undoLastContribution, invite, respondInvite, leave],
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals(): GoalsState {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals muss innerhalb von <GoalsProvider> verwendet werden');
  return ctx;
}

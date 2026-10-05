// Hält die Einträge (gekauft / nicht gekauft / Wunschliste) für die ganze App bereit.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { friendlyError } from '../lib/errors';
import {
  createItem as apiCreateItem,
  deleteItem as apiDeleteItem,
  fetchItems,
  updateItemStatus as apiUpdateItemStatus,
} from '../lib/items';
import type { Item, ItemStatus, NewItem } from '../lib/items';
import { useApp } from './AppProvider';

type ItemsState = {
  items: Item[];
  loading: boolean;
  errorMessage: string | null;
  reload: () => void;
  createItem: (item: NewItem) => Promise<Item>;
  updateItemStatus: (id: string, status: ItemStatus) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
};

const ItemsContext = createContext<ItemsState | null>(null);

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { status, session } = useApp();
  const userId = session?.user.id ?? null;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadId = useRef(0);

  // State wird erst in den Callbacks gesetzt, wenn die Daten da sind.
  const load = useCallback(() => {
    const id = ++loadId.current;
    fetchItems().then(
      (result) => {
        if (id !== loadId.current) return;
        setItems(result);
        setErrorMessage(null);
        setLoading(false);
      },
      (error: unknown) => {
        if (id !== loadId.current) return;
        console.warn('Einträge laden fehlgeschlagen', error);
        setErrorMessage(friendlyError(error));
        setLoading(false);
      },
    );
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  // Neu laden, sobald die App bereit ist oder ein anderer Nutzer angemeldet ist.
  useEffect(() => {
    if (status === 'ready' && userId) load();
  }, [status, userId, load]);

  const createItem = useCallback(async (item: NewItem) => {
    const created = await apiCreateItem(item);
    setItems((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateItemStatus = useCallback(async (id: string, newStatus: ItemStatus) => {
    const updated = await apiUpdateItemStatus(id, newStatus);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    await apiDeleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const value = useMemo<ItemsState>(
    () => ({ items, loading, errorMessage, reload, createItem, updateItemStatus, deleteItem }),
    [items, loading, errorMessage, reload, createItem, updateItemStatus, deleteItem],
  );

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

export function useItems(): ItemsState {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems muss innerhalb von <ItemsProvider> verwendet werden');
  return ctx;
}

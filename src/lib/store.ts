import { openDB, type IDBPDatabase } from 'idb';
import type { RepMove } from './repertoire';

const DB_NAME = 'opening-trainer';
const DB_VERSION = 1;

export interface Store {
  loadMoves(): Promise<RepMove[]>;
  putMoves(moves: RepMove[]): Promise<void>;
  deleteMoves(ids: string[]): Promise<void>;
}

/** IndexedDB-backed storage. Later milestones add stores for review cards and the review log. */
export async function openStore(name = DB_NAME): Promise<Store> {
  const db: IDBPDatabase = await openDB(name, DB_VERSION, {
    upgrade(db) {
      const moves = db.createObjectStore('moves', { keyPath: 'id' });
      moves.createIndex('side', 'side');
    },
  });
  return {
    loadMoves: () => db.getAll('moves'),
    async putMoves(moves) {
      const tx = db.transaction('moves', 'readwrite');
      await Promise.all([...moves.map((m) => tx.store.put(m)), tx.done]);
    },
    async deleteMoves(ids) {
      const tx = db.transaction('moves', 'readwrite');
      await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    },
  };
}

/** Asks Safari not to evict this app's data under storage pressure. Returns whether it agreed. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

import { openDB, type IDBPDatabase } from 'idb';
import type { RepMove } from './repertoire';
import type { CardRecord, LogEntry } from './drill';

const DB_NAME = 'opening-trainer';
const DB_VERSION = 2;

export interface Store {
  loadMoves(): Promise<RepMove[]>;
  putMoves(moves: RepMove[]): Promise<void>;
  deleteMoves(ids: string[]): Promise<void>;
  loadCards(): Promise<CardRecord[]>;
  putCard(card: CardRecord, log: LogEntry): Promise<void>;
  loadLog(): Promise<LogEntry[]>;
}

/** IndexedDB-backed storage. Later milestones add stores for review cards and the review log. */
export async function openStore(name = DB_NAME): Promise<Store> {
  const db: IDBPDatabase = await openDB(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const moves = db.createObjectStore('moves', { keyPath: 'id' });
        moves.createIndex('side', 'side');
      }
      if (oldVersion < 2) {
        db.createObjectStore('cards', { keyPath: 'id' });
        db.createObjectStore('log', { autoIncrement: true });
      }
    },
  });
  return {
    loadMoves: () => db.getAll('moves'),
    async putMoves(moves) {
      const tx = db.transaction('moves', 'readwrite');
      await Promise.all([...moves.map((m) => tx.store.put(m)), tx.done]);
    },
    /** Deleting a move also deletes its review card, so a replaced move starts fresh. */
    async deleteMoves(ids) {
      const tx = db.transaction(['moves', 'cards'], 'readwrite');
      const moves = tx.objectStore('moves');
      const cards = tx.objectStore('cards');
      await Promise.all([...ids.flatMap((id) => [moves.delete(id), cards.delete(id)]), tx.done]);
    },
    loadCards: () => db.getAll('cards'),
    async putCard(card, log) {
      const tx = db.transaction(['cards', 'log'], 'readwrite');
      await Promise.all([tx.objectStore('cards').put(card), tx.objectStore('log').add(log), tx.done]);
    },
    loadLog: () => db.getAll('log'),
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

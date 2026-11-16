import { Chess } from 'chess.js';

export type Side = 'white' | 'black';

/** One move in a repertoire tree. Positions are keyed without move counters, so transpositions meet. */
export interface RepMove {
  id: string;
  side: Side;
  from: string;
  to: string;
  san: string;
  /** True when this is the repertoire owner's move (the side to move at `from` is `side`). */
  mine: boolean;
  createdAt: number;
}

export const START_KEY = posKey(new Chess().fen());

/** FEN without the halfmove and fullmove counters. */
export function posKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function moveId(side: Side, from: string, san: string): string {
  return `${side}|${from}|${san}`;
}

export function sideToMove(key: string): Side {
  return key.split(' ')[1] === 'w' ? 'white' : 'black';
}

export type AddResult =
  | { status: 'added'; move: RepMove }
  | { status: 'exists'; move: RepMove }
  | { status: 'conflict'; existing: RepMove };

/** An in-memory repertoire for both sides. Persistence is done by the caller from the returned changes. */
export class Repertoire {
  private byId = new Map<string, RepMove>();

  constructor(moves: RepMove[] = []) {
    for (const m of moves) this.byId.set(m.id, m);
  }

  all(): RepMove[] {
    return [...this.byId.values()];
  }

  count(side: Side): number {
    let n = 0;
    for (const m of this.byId.values()) if (m.side === side) n++;
    return n;
  }

  /** Moves stored from a position, oldest first. */
  movesFrom(side: Side, fromFen: string): RepMove[] {
    const from = posKey(fromFen);
    return this.all()
      .filter((m) => m.side === side && m.from === from)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /** The owner's chosen reply in a position, if any. */
  myMoveAt(side: Side, fromFen: string): RepMove | undefined {
    return this.movesFrom(side, fromFen).find((m) => m.mine);
  }

  /**
   * Adds a move. Opponent moves may branch freely; the owner keeps one reply per position,
   * so a different reply where one exists comes back as a conflict for the caller to resolve.
   */
  add(side: Side, beforeFen: string, san: string, afterFen: string, now = Date.now()): AddResult {
    const from = posKey(beforeFen);
    const id = moveId(side, from, san);
    const found = this.byId.get(id);
    if (found) return { status: 'exists', move: found };
    const mine = sideToMove(from) === side;
    if (mine) {
      const existing = this.myMoveAt(side, from);
      if (existing) return { status: 'conflict', existing };
    }
    const move: RepMove = { id, side, from, to: posKey(afterFen), san, mine, createdAt: now };
    this.byId.set(id, move);
    return { status: 'added', move };
  }

  /** Deletes a move, then everything no longer reachable from the start. Returns the ids removed. */
  delete(id: string): string[] {
    const target = this.byId.get(id);
    if (!target) return [];
    this.byId.delete(id);
    const removed = [id, ...this.prune(target.side)];
    return removed;
  }

  /** Swaps the owner's reply in a position: removes the old one (and its now-orphaned lines), adds the new one. */
  replace(existingId: string, side: Side, beforeFen: string, san: string, afterFen: string, now = Date.now()) {
    const removed = this.delete(existingId);
    const result = this.add(side, beforeFen, san, afterFen, now);
    if (result.status === 'conflict') throw new Error('replace left a conflicting move behind');
    return { removed, added: result.move };
  }

  private prune(side: Side): string[] {
    const reachable = new Set<string>([START_KEY]);
    const queue = [START_KEY];
    const sideMoves = this.all().filter((m) => m.side === side);
    while (queue.length) {
      const key = queue.shift()!;
      for (const m of sideMoves) {
        if (m.from === key && !reachable.has(m.to)) {
          reachable.add(m.to);
          queue.push(m.to);
        }
      }
    }
    const removed: string[] = [];
    for (const m of sideMoves) {
      if (!reachable.has(m.from)) {
        this.byId.delete(m.id);
        removed.push(m.id);
      }
    }
    return removed;
  }
}

import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade as FsrsGrade } from 'ts-fsrs';
import { START_KEY, type Repertoire, type RepMove, type Side } from './repertoire';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** Review state for one of the owner's moves. The id matches the RepMove id. */
export interface CardRecord {
  id: string;
  side: Side;
  card: Card;
  lastGrade: Grade;
}

export interface LogEntry {
  cardId: string;
  grade: Grade;
  reviewedAt: Date;
  wasNew: boolean;
}

export interface QueueItem {
  move: RepMove;
  /** Moves from the start position up to the position where the owner must answer. */
  path: string[];
  record?: CardRecord;
  /** Show the answer first, ungraded, then ask it again later in the session. */
  learn?: boolean;
  /** An extra ungraded repeat of a move missed earlier in this session. */
  practice?: boolean;
}

export const NEW_PER_DAY = 10;
export const EASY_MS = 3000;

// Day-based scheduling: a daily-habit app has no use for minute-long learning steps.
const scheduler = fsrs(
  generatorParameters({ request_retention: 0.9, learning_steps: [], relearning_steps: [], enable_fuzz: true }),
);

const RATING: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/**
 * Grades an answer without asking the player to rate themselves.
 * Two misses or a hint = again; one miss = hard; quick and clean = easy (never for a move just learned).
 */
export function gradeAttempt(a: { wrong: number; hinted: boolean; ms: number; isNew: boolean }): Grade {
  if (a.hinted || a.wrong >= 2) return 'again';
  if (a.wrong === 1) return 'hard';
  if (a.ms < EASY_MS && !a.isNew) return 'easy';
  return 'good';
}

export function schedule(record: CardRecord | undefined, move: RepMove, grade: Grade, now: Date): CardRecord {
  const card: Card = record?.card ?? (createEmptyCard(now) as Card);
  const next = scheduler.next(card, now, RATING[grade]).card;
  return { id: move.id, side: move.side, card: next, lastGrade: grade };
}

/** Shortest line of moves from the start position to `key` in one side's repertoire, or null if unreachable. */
export function pathTo(rep: Repertoire, side: Side, key: string): string[] | null {
  if (key === START_KEY) return [];
  const moves = rep.all().filter((m) => m.side === side);
  const prev = new Map<string, RepMove>();
  const seen = new Set([START_KEY]);
  const queue = [START_KEY];
  while (queue.length) {
    const at = queue.shift()!;
    for (const m of moves) {
      if (m.from !== at || seen.has(m.to)) continue;
      seen.add(m.to);
      prev.set(m.to, m);
      if (m.to === key) {
        const path: string[] = [];
        for (let k = key; k !== START_KEY; k = prev.get(k)!.from) path.unshift(prev.get(k)!.san);
        return path;
      }
      queue.push(m.to);
    }
  }
  return null;
}

/** How many new moves were started on the local calendar day of `now`. */
export function newToday(log: LogEntry[], now: Date): number {
  const day = now.toDateString();
  return log.filter((e) => e.wasNew && e.reviewedAt.toDateString() === day).length;
}

/**
 * Today's queue: moves missed last time first, then the rest that are due (most overdue first),
 * then new moves up to the daily limit, in the order they were added.
 */
export function buildQueue(
  rep: Repertoire,
  cards: Map<string, CardRecord>,
  now: Date,
  newAllowed: number,
): QueueItem[] {
  const due: QueueItem[] = [];
  const fresh: QueueItem[] = [];
  for (const move of rep.all()) {
    if (!move.mine) continue;
    const path = pathTo(rep, move.side, move.from);
    if (!path) continue;
    const record = cards.get(move.id);
    if (!record) fresh.push({ move, path, learn: true });
    else if (record.card.due.getTime() <= now.getTime()) due.push({ move, path, record });
  }
  const missed = (i: QueueItem) => (i.record!.lastGrade === 'again' ? 0 : 1);
  due.sort((a, b) => missed(a) - missed(b) || a.record!.card.due.getTime() - b.record!.card.due.getTime());
  fresh.sort((a, b) => a.move.createdAt - b.move.createdAt);
  return [...due, ...fresh.slice(0, Math.max(0, newAllowed))];
}

/** Earliest due date among cards, for "next review" on the done screen. */
export function nextDue(cards: Iterable<CardRecord>): Date | undefined {
  let best: Date | undefined;
  for (const c of cards) if (!best || c.card.due < best) best = c.card.due;
  return best;
}

/** Consecutive days with at least one review, ending today (or yesterday, if today has none yet). */
export function streak(log: LogEntry[], now: Date): number {
  const days = new Set(log.map((e) => e.reviewedAt.toDateString()));
  const d = new Date(now);
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toDateString())) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

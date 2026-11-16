import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { Repertoire, posKey, type Side } from './repertoire';
import { buildQueue, gradeAttempt, newToday, pathTo, schedule, streak, type CardRecord, type LogEntry } from './drill';

function addLine(rep: Repertoire, side: Side, sans: string[], t = 0) {
  const chess = new Chess();
  sans.forEach((san, i) => {
    const m = chess.move(san);
    rep.add(side, m.before, m.san, m.after, t + i);
  });
  return chess;
}

const day = (s: string) => new Date(`${s}T12:00:00`);

describe('gradeAttempt', () => {
  it('maps attempts to grades', () => {
    expect(gradeAttempt({ wrong: 0, hinted: false, ms: 1000, isNew: false })).toBe('easy');
    expect(gradeAttempt({ wrong: 0, hinted: false, ms: 1000, isNew: true })).toBe('good');
    expect(gradeAttempt({ wrong: 0, hinted: false, ms: 8000, isNew: false })).toBe('good');
    expect(gradeAttempt({ wrong: 1, hinted: false, ms: 1000, isNew: false })).toBe('hard');
    expect(gradeAttempt({ wrong: 2, hinted: false, ms: 1000, isNew: false })).toBe('again');
    expect(gradeAttempt({ wrong: 0, hinted: true, ms: 1000, isNew: false })).toBe('again');
  });
});

describe('pathTo', () => {
  it('finds the line that reaches a position', () => {
    const rep = new Repertoire();
    const chess = addLine(rep, 'white', ['e4', 'c5', 'Nf3', 'd6']);
    expect(pathTo(rep, 'white', posKey(chess.fen()))).toEqual(['e4', 'c5', 'Nf3', 'd6']);
  });

  it('is empty for the start position and null for an unknown one', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4']);
    expect(pathTo(rep, 'white', posKey(new Chess().fen()))).toEqual([]);
    expect(pathTo(rep, 'black', posKey('8/8/8/8/8/8/8/K6k w - - 0 1'))).toBeNull();
  });
});

describe('schedule', () => {
  it('pushes a well-known move further out each time', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4']);
    const move = rep.all()[0];
    const r1 = schedule(undefined, move, 'good', day('2026-01-01'));
    const r2 = schedule(r1, move, 'good', r1.card.due);
    const gap = (r: CardRecord, from: Date) => (r.card.due.getTime() - from.getTime()) / 86_400_000;
    expect(gap(r1, day('2026-01-01'))).toBeGreaterThanOrEqual(1);
    expect(gap(r2, r1.card.due)).toBeGreaterThan(gap(r1, day('2026-01-01')));
  });

  it('brings a missed move back within a couple of days', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4']);
    const move = rep.all()[0];
    let r = schedule(undefined, move, 'good', day('2026-01-01'));
    r = schedule(r, move, 'good', r.card.due);
    const missedAt = r.card.due;
    r = schedule(r, move, 'again', missedAt);
    expect((r.card.due.getTime() - missedAt.getTime()) / 86_400_000).toBeLessThanOrEqual(3);
    expect(r.lastGrade).toBe('again');
  });
});

describe('buildQueue', () => {
  it('asks only the owner’s moves, missed ones first, then overdue, then new up to the limit', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4', 'c5', 'Nf3', 'd6', 'd4']);
    addLine(rep, 'white', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 10);
    const byFirst = (san: string, after: string[]) =>
      rep.all().find((m) => m.san === san && pathTo(rep, 'white', m.from)?.join() === after.join())!;
    const now = day('2026-03-10');
    const cards = new Map<string, CardRecord>();
    const e4 = byFirst('e4', []);
    const nf3 = byFirst('Nf3', ['e4', 'c5']);
    cards.set(e4.id, { ...schedule(undefined, e4, 'good', day('2026-03-01')), lastGrade: 'good' });
    cards.set(nf3.id, { ...schedule(undefined, nf3, 'again', day('2026-03-08')) });
    const q = buildQueue(rep, cards, now, 2);
    expect(q.map((i) => i.move.san)).toEqual(['Nf3', 'e4', 'd4', 'Nf3']);
    expect(q[0].path).toEqual(['e4', 'c5']);
    expect(q.slice(2).every((i) => i.learn)).toBe(true);
  });

  it('leaves out moves that are not due yet', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4']);
    const e4 = rep.all()[0];
    const cards = new Map([[e4.id, schedule(undefined, e4, 'easy', day('2026-03-01'))]]);
    expect(buildQueue(rep, cards, day('2026-03-02'), 10)).toEqual([]);
  });
});

describe('streak and daily limits', () => {
  const log = (dates: string[], wasNew = false): LogEntry[] =>
    dates.map((d) => ({ cardId: 'x', grade: 'good', reviewedAt: day(d), wasNew }));

  it('counts consecutive days ending today or yesterday', () => {
    expect(streak(log(['2026-03-08', '2026-03-09', '2026-03-10']), day('2026-03-10'))).toBe(3);
    expect(streak(log(['2026-03-08', '2026-03-09']), day('2026-03-10'))).toBe(2);
    expect(streak(log(['2026-03-07']), day('2026-03-10'))).toBe(0);
  });

  it('counts new moves started today', () => {
    expect(newToday([...log(['2026-03-10', '2026-03-10'], true), ...log(['2026-03-10'])], day('2026-03-10'))).toBe(2);
  });
});

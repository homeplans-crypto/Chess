import { Chess } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { RepMove } from './repertoire';

/** Green arrow for the owner's move, blue arrows for the opponent replies stored here. */
export function repertoireArrows(fen: string, moves: RepMove[]): DrawShape[] {
  const shapes: DrawShape[] = [];
  for (const m of moves) {
    try {
      const mv = new Chess(fen).move(m.san);
      shapes.push({ orig: mv.from as Key, dest: mv.to as Key, brush: m.mine ? 'green' : 'blue' });
    } catch {
      // A stored move that is not legal here (should not happen) is simply not drawn.
    }
  }
  return shapes;
}

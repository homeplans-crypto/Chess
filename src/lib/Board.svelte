<script lang="ts">
  import { onMount } from 'svelte';
  import { Chessground } from 'chessground';
  import type { Api } from 'chessground/api';
  import type { Key } from 'chessground/types';
  import type { Chess } from 'chess.js';
  import { legalDests, playMove, turnColor } from './game';

  let {
    chess,
    orientation = 'white',
    version = 0,
    onmove,
  }: {
    chess: Chess;
    orientation?: 'white' | 'black';
    /** Bump to make the board re-read the position after an outside change (undo, reset). */
    version?: number;
    onmove: (san: string) => void;
  } = $props();

  let el: HTMLDivElement;
  let cg: Api | undefined;

  function sync() {
    if (!cg) return;
    const last = chess.history({ verbose: true }).at(-1);
    cg.set({
      fen: chess.fen(),
      orientation,
      turnColor: turnColor(chess),
      check: chess.inCheck(),
      lastMove: last ? [last.from as Key, last.to as Key] : undefined,
      movable: { color: turnColor(chess), dests: legalDests(chess) },
    });
  }

  onMount(() => {
    cg = Chessground(el, {
      animation: { duration: 200 },
      highlight: { lastMove: true, check: true },
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (from, to) => {
            const san = playMove(chess, from, to);
            sync();
            if (san) onmove(san);
          },
        },
      },
      draggable: { showGhost: true },
    });
    sync();
    return () => cg?.destroy();
  });

  $effect(() => {
    void orientation;
    void version;
    sync();
  });
</script>

<div class="board-wrap">
  <div class="board" bind:this={el}></div>
</div>

<style>
  .board-wrap {
    width: 100%;
    aspect-ratio: 1;
  }
  .board {
    width: 100%;
    height: 100%;
  }
</style>

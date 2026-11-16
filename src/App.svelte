<script lang="ts">
  import { Chess } from 'chess.js';
  import Board from './lib/Board.svelte';
  import { moveRows } from './lib/game';

  const chess = new Chess();
  let history = $state<string[]>([]);
  let orientation = $state<'white' | 'black'>('white');
  let version = $state(0);

  function refresh() {
    history = chess.history();
    version++;
  }
  function undo() {
    chess.undo();
    refresh();
  }
  function reset() {
    chess.reset();
    refresh();
  }
  function flip() {
    orientation = orientation === 'white' ? 'black' : 'white';
  }

  let status = $derived.by(() => {
    void history;
    if (chess.isCheckmate()) return 'Checkmate';
    if (chess.isDraw()) return 'Draw';
    return `${chess.turn() === 'w' ? 'White' : 'Black'} to move`;
  });
</script>

<main>
  <section class="board-area">
    <Board {chess} {orientation} {version} onmove={() => (history = chess.history())} />
  </section>

  <aside class="panel">
    <h1>Opening Trainer</h1>
    <p class="status" data-testid="status">{status}</p>

    <ol class="moves" data-testid="moves">
      {#each moveRows(history) as [n, white, black] (n)}
        <li><span class="num">{n}.</span> <span>{white}</span> <span>{black ?? ''}</span></li>
      {:else}
        <li class="empty">Make a move on the board</li>
      {/each}
    </ol>

    <div class="buttons">
      <button onclick={undo} disabled={history.length === 0}>Undo</button>
      <button onclick={flip}>Flip board</button>
      <button onclick={reset} disabled={history.length === 0}>Reset</button>
    </div>
  </aside>
</main>

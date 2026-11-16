<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Chess } from 'chess.js';
  import Board from './Board.svelte';
  import { repertoireArrows } from './arrows';
  import { posKey, Repertoire, sideToMove, type RepMove, type Side } from './repertoire';
  import type { Store } from './store';

  let {
    rep,
    store,
    header,
    onchange,
  }: { rep: Repertoire; store: Store | undefined; header: Snippet; onchange: () => void } = $props();

  const chess = new Chess();

  let side = $state<Side>('white');
  let line = $state<string[]>([]);
  let version = $state(0);
  let tick = $state(0);
  let saveError = $state('');
  let conflict = $state<{ existing: RepMove; before: string; san: string; after: string } | null>(null);
  let confirmDelete = $state(false);

  async function save(put: RepMove[], remove: string[] = []) {
    try {
      if (remove.length) await store?.deleteMoves(remove);
      if (put.length) await store?.putMoves(put);
      saveError = '';
      onchange();
    } catch (e) {
      saveError = `Not saved: ${(e as Error).message}`;
    }
  }

  function changed() {
    line = chess.history();
    confirmDelete = false;
    version++;
    tick++;
  }

  function onBoardMove() {
    const last = chess.history({ verbose: true }).at(-1)!;
    const result = rep.add(side, last.before, last.san, last.after);
    if (result.status === 'conflict') {
      chess.undo();
      conflict = { existing: result.existing, before: last.before, san: last.san, after: last.after };
    } else {
      conflict = null;
      if (result.status === 'added') void save([result.move]);
    }
    changed();
  }

  function replaceMove() {
    if (!conflict) return;
    const { removed, added } = rep.replace(conflict.existing.id, side, conflict.before, conflict.san, conflict.after);
    void save([added], removed);
    chess.move(conflict.san);
    conflict = null;
    changed();
  }

  function playStored(san: string) {
    chess.move(san);
    conflict = null;
    changed();
  }

  function goTo(ply: number) {
    while (chess.history().length > ply) chess.undo();
    conflict = null;
    changed();
  }

  function setSide(s: Side) {
    side = s;
    goTo(0);
  }

  // The stored move that led to the current position, if the whole line is in the repertoire.
  let currentMove = $derived.by(() => {
    void tick;
    const last = chess.history({ verbose: true }).at(-1);
    if (!last) return undefined;
    return rep.movesFrom(side, last.before).find((m) => m.san === last.san);
  });

  let deleteCount = $derived.by(() => {
    void tick;
    if (!currentMove) return 0;
    const trial = new Repertoire(rep.all());
    return trial.delete(currentMove.id).length;
  });

  function deleteMove() {
    if (!currentMove) return;
    if (!confirmDelete) {
      confirmDelete = true;
      return;
    }
    const removed = rep.delete(currentMove.id);
    void save([], removed);
    chess.undo();
    changed();
  }

  let here = $derived.by(() => {
    void tick;
    void line;
    return rep.movesFrom(side, chess.fen());
  });
  let shapes = $derived(repertoireArrows(chess.fen(), here));
  let myTurn = $derived.by(() => {
    void line;
    return sideToMove(posKey(chess.fen())) === side;
  });
  let counts = $derived.by(() => {
    void tick;
    return { white: rep.count('white'), black: rep.count('black') };
  });
  let lineRows = $derived(
    line.map((san, i) => ({ ply: i + 1, label: i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san })),
  );
</script>

<main>
  <section class="board-area">
    <Board {chess} orientation={side} {version} {shapes} onmove={onBoardMove} />
  </section>

  <aside class="panel">
    {@render header()}
    <div class="tabs" role="tablist">
      {#each ['white', 'black'] as const as s (s)}
        <button role="tab" class:active={side === s} aria-selected={side === s} onclick={() => setSide(s)}>
          {s === 'white' ? 'White' : 'Black'} <span class="count">{counts[s]}</span>
        </button>
      {/each}
    </div>

    <div class="line" data-testid="line">
      <button class="ply" class:current={line.length === 0} onclick={() => goTo(0)}>Start</button>
      {#each lineRows as row (row.ply)}
        <button class="ply" class:current={row.ply === line.length} onclick={() => goTo(row.ply)}>{row.label}</button>
      {/each}
    </div>

    {#if conflict}
      <div class="banner" data-testid="conflict">
        <p>You already play <b>{conflict.existing.san}</b> here. Replace it with <b>{conflict.san}</b>? The lines after {conflict.existing.san} go too.</p>
        <div class="row">
          <button class="primary" onclick={replaceMove}>Replace</button>
          <button onclick={() => (conflict = null)}>Keep {conflict.existing.san}</button>
        </div>
      </div>
    {/if}

    <h2>{myTurn ? 'Your move' : 'Their replies'}</h2>
    <div class="here" data-testid="here">
      {#each here as m (m.id)}
        <button class="move" class:mine={m.mine} onclick={() => playStored(m.san)}>{m.san}</button>
      {:else}
        <p class="hint">
          {#if myTurn}Play your move on the board to add it.{:else}Play the replies you expect; add as many as you like.{/if}
        </p>
      {/each}
    </div>

    {#if saveError}<p class="error">{saveError}</p>{/if}

    <div class="buttons">
      <button onclick={() => goTo(0)} disabled={line.length === 0}>Start</button>
      <button onclick={() => goTo(line.length - 1)} disabled={line.length === 0}>Back</button>
      <button class:danger={confirmDelete} onclick={deleteMove} disabled={!currentMove} data-testid="delete">
        {#if confirmDelete}Delete {deleteCount} move{deleteCount === 1 ? '' : 's'}?{:else}Delete move{/if}
      </button>
    </div>
  </aside>
</main>

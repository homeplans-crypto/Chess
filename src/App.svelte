<script lang="ts">
  import { onMount } from 'svelte';
  import Builder from './lib/Builder.svelte';
  import Drill from './lib/Drill.svelte';
  import { buildQueue, newToday, NEW_PER_DAY, streak, type CardRecord, type LogEntry } from './lib/drill';
  import { Repertoire } from './lib/repertoire';
  import { openStore, requestPersistence, type Store } from './lib/store';

  let rep = $state.raw(new Repertoire());
  let store = $state.raw<Store | undefined>();
  let cards = $state.raw(new Map<string, CardRecord>());
  let log = $state.raw<LogEntry[]>([]);

  let mode = $state<'review' | 'build'>('review');
  let drilling = $state(false);
  let loaded = $state(false);
  let error = $state('');
  let tick = $state(0);

  onMount(async () => {
    try {
      store = await openStore();
      rep = new Repertoire(await store.loadMoves());
      cards = new Map((await store.loadCards()).map((c) => [c.id, c]));
      log = await store.loadLog();
      void requestPersistence();
    } catch (e) {
      error = `Could not open storage: ${(e as Error).message}`;
    }
    loaded = true;
    if (rep.count('white') + rep.count('black') === 0) mode = 'build';
    tick++;
  });

  let stats = $derived.by(() => {
    void tick;
    const now = new Date();
    const queue = buildQueue(rep, cards, now, NEW_PER_DAY - newToday(log, now));
    return {
      due: queue.filter((i) => !i.learn).length,
      fresh: queue.filter((i) => i.learn).length,
      streak: streak(log, now),
      moves: rep.all().filter((m) => m.mine).length,
    };
  });

  /** Moves deleted in Build take their review cards with them (the store already dropped them). */
  function builderChanged() {
    const ids = new Set(rep.all().map((m) => m.id));
    for (const id of cards.keys()) if (!ids.has(id)) cards.delete(id);
    tick++;
  }

  function setMode(m: 'review' | 'build') {
    mode = m;
    drilling = false;
    tick++;
  }
</script>

{#snippet header()}
  <div class="tabs modes" role="tablist">
    <button role="tab" class:active={mode === 'review'} aria-selected={mode === 'review'} onclick={() => setMode('review')}>Review</button>
    <button role="tab" class:active={mode === 'build'} aria-selected={mode === 'build'} onclick={() => setMode('build')}>Build</button>
  </div>
{/snippet}

{#if !loaded}
  <main class="center"><p class="hint">Loading…</p></main>
{:else if mode === 'build'}
  <Builder {rep} {store} {header} onchange={builderChanged} />
{:else if drilling}
  <Drill {rep} {store} {cards} {log} {header} onfinish={() => { drilling = false; tick++; }} />
{:else}
  <main class="center">
    <aside class="panel home">
      {@render header()}
      <h1>Today</h1>
      <div class="stats" data-testid="stats">
        <div><b>{stats.due}</b><span>due</span></div>
        <div><b>{stats.fresh}</b><span>new</span></div>
        <div><b>{stats.streak}</b><span>day streak</span></div>
      </div>
      {#if error}<p class="error">{error}</p>{/if}
      {#if stats.moves === 0}
        <p class="hint">Your repertoire is empty. Add your moves in Build, then review them here.</p>
      {:else if stats.due + stats.fresh === 0}
        <p class="hint">All caught up. Come back tomorrow.</p>
      {/if}
      <div class="buttons">
        <button class="primary" disabled={stats.due + stats.fresh === 0} onclick={() => (drilling = true)}>Start review</button>
      </div>
    </aside>
  </main>
{/if}

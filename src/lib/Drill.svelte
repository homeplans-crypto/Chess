<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { Chess } from 'chess.js';
  import Board from './Board.svelte';
  import { repertoireArrows } from './arrows';
  import { buildQueue, gradeAttempt, newToday, nextDue, NEW_PER_DAY, schedule, type CardRecord, type LogEntry, type QueueItem } from './drill';
  import type { Repertoire } from './repertoire';
  import type { Store } from './store';

  let {
    rep,
    store,
    cards,
    log,
    header,
    onfinish,
  }: {
    rep: Repertoire;
    store: Store | undefined;
    cards: Map<string, CardRecord>;
    log: LogEntry[];
    header: Snippet;
    onfinish: () => void;
  } = $props();

  const chess = new Chess();
  let queue = $state<QueueItem[]>([]);
  let index = $state(0);
  let version = $state(0);
  let locked = $state(true);
  let wrong = $state(0);
  let hinted = $state(false);
  let feedback = $state<'' | 'right' | 'wrong'>('');
  let graded = $state(0);
  let saveError = $state('');
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  let item = $derived(queue[index]);
  // New moves are asked twice (learn, then test), so count their second turn up front.
  let total = $derived(queue.length + queue.slice(index).filter((i) => i.learn).length);
  let done = $derived(queue.length > 0 && index >= queue.length);
  let showAnswer = $derived(!!item && (item.learn || hinted || wrong >= 2));
  let shapes = $derived.by(() => {
    void version;
    return item && showAnswer && !locked ? repertoireArrows(chess.fen(), [item.move]) : [];
  });
  let line = $derived.by(() => {
    void version;
    return chess.history();
  });

  onMount(() => {
    queue = buildQueue(rep, cards, new Date(), NEW_PER_DAY - newToday(log, new Date()));
    setup();
    return () => clearTimeout(timer);
  });

  /** Sets the board to just before the opponent's last move, then plays it. */
  function setup() {
    clearTimeout(timer);
    wrong = 0;
    hinted = false;
    feedback = '';
    chess.reset();
    if (!item) return;
    const { path } = item;
    for (const san of path.slice(0, -1)) chess.move(san);
    locked = true;
    version++;
    const unlock = () => {
      locked = false;
      startedAt = performance.now();
      version++;
    };
    if (path.length) {
      timer = setTimeout(() => {
        chess.move(path[path.length - 1]);
        version++;
        timer = setTimeout(unlock, 250);
      }, 450);
    } else {
      unlock();
    }
  }

  async function record(rec: CardRecord, entry: LogEntry) {
    cards.set(rec.id, rec);
    log.push(entry);
    try {
      await store?.putCard(rec, entry);
      saveError = '';
    } catch (e) {
      saveError = `Not saved: ${(e as Error).message}`;
    }
  }

  function onBoardMove(san: string) {
    if (!item) return;
    if (san !== item.move.san) {
      chess.undo();
      wrong++;
      feedback = 'wrong';
      version++;
      return;
    }
    locked = true;
    feedback = 'right';
    const now = new Date();
    if (item.learn) {
      queue.push({ ...item, learn: false });
    } else if (!item.practice) {
      const isNew = !item.record;
      const grade = gradeAttempt({ wrong, hinted, ms: performance.now() - startedAt, isNew });
      const rec = schedule(item.record, item.move, grade, now);
      void record(rec, { cardId: rec.id, grade, reviewedAt: now, wasNew: isNew });
      graded++;
      if (grade === 'again') queue.push({ ...item, record: rec, practice: true });
    }
    version++;
    timer = setTimeout(next, 700);
  }

  function next() {
    index++;
    setup();
  }

  function hint() {
    hinted = true;
    version++;
  }

  let prompt = $derived.by(() => {
    if (!item) return '';
    if (locked && feedback !== 'right') return 'Watch their move…';
    if (item.learn) return 'New move: play the green arrow.';
    if (item.practice) return 'Once more: play your move.';
    if (wrong >= 2) return 'Play the move shown.';
    return 'Your move.';
  });
  let upcoming = $derived(done ? nextDue(cards.values()) : undefined);
</script>

<main>
  <section class="board-area">
    <Board {chess} orientation={item?.move.side ?? 'white'} {version} {shapes} {locked} onmove={onBoardMove} />
  </section>

  <aside class="panel">
    {@render header()}

    {#if queue.length === 0}
      <h2>Nothing to review</h2>
      <p class="hint">Add your moves in Build first, then come back here.</p>
      <div class="buttons"><button onclick={onfinish}>Back</button></div>
    {:else if done}
      <h2>Session complete</h2>
      <p class="big" data-testid="summary">{graded} move{graded === 1 ? '' : 's'} reviewed</p>
      {#if upcoming}<p class="hint">Next review: {upcoming.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>{/if}
      <div class="buttons"><button class="primary" onclick={onfinish}>Done</button></div>
    {:else}
      <p class="progress" data-testid="progress">
        {index + 1} of {total} · {item.move.side === 'white' ? 'White' : 'Black'}
      </p>
      <div class="line">
        {#each line as san, i (i)}<span class="ply static">{i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san}</span>{/each}
      </div>
      <h2 data-testid="prompt">{prompt}</h2>
      <p class="feedback {feedback}" data-testid="feedback">
        {#if feedback === 'right'}Correct{:else if feedback === 'wrong'}Not that move{/if}
      </p>
      {#if saveError}<p class="error">{saveError}</p>{/if}
      <div class="buttons">
        <button onclick={onfinish}>End session</button>
        <button onclick={hint} disabled={showAnswer || locked}>Show move</button>
      </div>
    {/if}
  </aside>
</main>

# Opening Trainer

A personal iPad web app for building a chess opening repertoire and drilling it with spaced repetition (FSRS).
It installs to the iPad Home Screen and works offline. The plan lives in the project's design doc.

## Use it on the iPad

1. Open https://homeplans-crypto.github.io/Chess/ in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it from the Home Screen icon. It runs full screen and works without a connection after the first load.

## Develop

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests (Vitest)
npm run check   # type check
npm run build   # production build in dist/
```

Every push to `main` is tested and deployed to GitHub Pages by `.github/workflows/pages.yml`.

## Milestones

1. Board on the iPad (installable shell, legal moves)
2. Repertoire builder (White and Black trees, saved on the iPad)
3. Drill with FSRS (learn new moves, daily review, automatic grading, streak) ← current
4. PGN import and backup
5. Polish

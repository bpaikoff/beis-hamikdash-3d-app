# CLAUDE.md — Beis HaMikdash 3D walkthrough

First-person three.js walkthrough of the Second Temple (React 18, three 0.160, Vite 7,
Node 22). Live at https://beis-hamikdash-3d-production.up.railway.app (Railway service
`beis-hamikdash-3d`, auto-deploys `master`; the mikdash.tzadek.ai CNAME is deferred).
Content model, geometry conventions and the review log: `docs/content.md`. Open items:
`docs/backlog.md`. Starter prompt for the next session: `docs/next-session.md`.

## Where to work

- Linux clone `~/prod/beis-hamikdash-3d-app` (this repo). The Windows checkout under
  `/mnt/c/Users/brand/...` is slow and shows CRLF churn; do not work there.
- Node 22 via nvm: prefix commands with `. ~/.nvm/nvm.sh &&`.
- Agent worktrees: `git worktree add ~/prod/bhm-wt/<name> -b <branch> master` with
  `ln -s ~/prod/beis-hamikdash-3d-app/node_modules ~/prod/bhm-wt/<name>/node_modules`.
  `.gitignore` must say `node_modules` (no trailing slash) or the symlink gets committed.
- Headless Chromium works locally (`sudo npx playwright install-deps chromium` was run).

## Content rules

- `src/content/temple.json` is hand-formatted. Edit it with exact-text replacements
  (python `str.replace` with an assert, or Edit). Never `json.dump` it back: that makes
  a 7k-line diff and is rejected.
- Frame: amos in the azarah frame, origin the Nicanor threshold, +x north, -z west,
  1 amah = 0.5 m (`src/content/units.js`: `toWorld`, `worldPos`, `levelWorldY`,
  `walkableBounds`). Floor levels in `meta.levels`.
- Every placement not given by a source is a reconstruction: say so in the entry's note
  and, when it contradicts nothing but fills a gap, in `meta.disputes`. Cite Mishnah
  Middot chapter:mishnah; run `node scripts/verify_refs.mjs` after any ref change.
- The 16-amah drop from the Azarah chambers to the Cheil on the north and south is the
  eastern level carried round; no source gives it. Keep saying that.

## Verification (every merge to master)

```bash
npm run lint && npm test -- --run && npm run build     # 0 errors, all tests, build green
node scripts/verify_refs.mjs                           # when content changed
node scripts/walk.mjs --list                           # ~70 routes across scripts/walk-routes/*.mjs
node scripts/walk.mjs --route a,b,c --port 43xx --out DIR     # ≤ 24 routes per process
node scripts/walk.mjs --fuzz 40 --fuzz-walk 3 --seed N --area <id> --port 43xx --out DIR
node scripts/screenshot.mjs --port 43xx --out DIR --budget hero=1200   # then Read the PNGs
```

- Walk all routes in at most three parallel processes on distinct ports; more than
  ~24 routes in one process, or many long outside routes, trips the 15-minute watchdog.
- Run fuzz **after** the route batches, one area at a time: under CPU contention the
  3-second stuck timer and the watchdog give false failures. A step that fails in a
  batch and passes alone is a load flake; note it, do not chase it.
- A `fell` that ends on a room floor under another floor (Klei Shir rooms, the Cheil
  vestibules) is reported as `in <room>` via `window.__mikdash.rooms`; a real fall is
  `inside a solid` or `under a floor` with no room there.
- Always Read the screenshots. The walkers cannot see z-fighting, floating furniture,
  missing door leaves, or a stair with an open side that happens to land on a floor.

## Route-writing lessons (from the perimeter walkers)

- The walker counts a leg reached 1.2 m short. A dip into a door must return to a
  point ≥ 3.5 amos clear of the reveal; a convex corner is turned at a waypoint 1.5 amos
  past the face just left with `reach: 0.3`, followed by a short clearance leg before
  closing on the next face.
- `expect: 'blocked'` legs need a `minY` when a drop is possible; the walkers now fail
  a blocked leg that jammed below its level.
- Route names must be unique across files (the loader throws on a duplicate).
- Hug distance 0.8 amos (0.4 m) against a 0.3 m player radius; straight legs must keep
  outside the Soreg (x ±83.5, z -203..157) unless they mean to cross an opening.

## How a round of work runs (what worked in September 2026)

1. **Plan** in `~/.claude/plans/` with the exact JSON values, builder functions and
   routes each agent owns, so agents never touch the same function.
2. **Build agents in parallel** (≤ 3 concurrent; a 4th hits the session rate limit):
   a content agent (JSON + the builders that read the moved values + the routes that
   cite them) and a geometry agent (new structures with tests and routes). Each owns a
   worktree and a branch, commits per milestone, does not push, and reports commits,
   old/new values, coordinates, results and screenshot paths.
3. **Merge and verify** on master after each agent (conflicts in temple.json are
   resolved by keeping both sides' lines, never by re-serializing).
4. **Walkers** (one per region) fuzz first, then add routes for "what a visitor would
   do", fix geometry in their own builders with height assertions, and Read screenshots.
5. **Reviewers**, read-only: a source reviewer for the JSON diff against Middot/Yoma/
   Tamid (returns paste-ready wording, most of it note corrections), and a code
   reviewer that probes the built scene with the real `PlayerController` (it found a
   shaft trap the walkers could not). Apply findings on master, re-walk the affected
   routes, re-fuzz, screenshot, push.
6. Update `docs/backlog.md` (closed items out, walker notes in) and `docs/content.md`'s
   review log; the memory note in `~/.claude/projects/-home-brand-prod-tzadek-ai/memory/`.

Operational rules: never `pkill -f` with a pattern that appears in the same command line
(it kills the shell); run long walks with `run_in_background` and bounded polls; agents
that stop mid-task ("waiting on the walker") are resumed with a short message telling
them to read their output file and finish; each agent uses its own port range.

## Related

- tzadek.ai (`~/prod/tzadek_ai`): the Ask panel streams from it with the guest passcode
  `mikdash_seed` (Railway `MIKDASH_PASSCODE` on the web service, `VITE_TZADEK_GUEST_PASSCODE`
  and `VITE_TZADEK_BASE` on this service). See `docs/ask.md`.

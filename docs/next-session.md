# Starter prompt for the next session

Paste this (or point Claude at it) to resume:

> Working in `~/prod/beis-hamikdash-3d-app` (master, live at https://mikdash.tzadek.ai and
> the Railway URL) and `~/prod/tzadek_ai` (branch `prod`, deploy the web service with
> `railway up` from `web/`). Read `CLAUDE.md` in the 3D repo for how rounds run, then
> `docs/backlog.md` for the open items and `docs/content.md`'s review log (Round 7,
> 2026-09-10) for the last round's reasoning.
>
> State on 2026-09-10: seven rounds merged. Round 7 answered the owner's first look at
> the live site: the Even HaShtiya is a bedrock outcrop in a dim Kodesh HaKodashim; the
> wood "flicker" was z-fighting (gate frames now 5 mm proud, flat leaves on thin walls,
> coplanar probes); an altar smoke column, Heichal haze, procedural ambient sound (muted,
> `M`) and kohanim walking the kevesh and at the kiyor; and the Avtinas/Palhedrin flip
> (Avtinas south over the Water Gate per Meiri / Yerushalmi Yoma 1:5, Palhedrin north west
> of the Korban gate as a reconstruction; source-reviewed wording). ~95 walk routes, fuzz on
> five areas, ~430 vitest tests, hero under the 1200 draw-call budget.
>
> Pick from the backlog, in this order unless told otherwise:
> 1. Look at the Beis HaMoked gate's swung gold leaves from the court (`beis_hamoked` view)
>    and the Avtinas storey from the Water Gate side; hand `cam` views for `ulam_facade`,
>    `?at=beis_avtinas`, `?at=taim`, `?at=pesach_haheichal`.
> 2. Sink the Middot 1:9 passage and bath below the Cheil pavement (a notch in
>    `HarHaBayisBuilder`'s slabs); open the vestibule's west bay to the Cheil door; a real
>    Flame.js flame for the passage lamps.
> 3. The ~455 non-wood coplanar pairs the probe lists (slab undersides, roof/wall tops);
>    a shared `noise.js` for the four value-noise/smoothstep copies.
> 4. Immersion round two: the tamid lamb led up the kevesh (animals have no `path` yet),
>    a Levite choir clip on the Duchan, torches at night, the Avtinas mikveh reachable.
>
> Constraints that still hold: surgical edits to `temple.json`, worktree per agent, commit
> per milestone, no `pkill -f` (and no `pgrep | xargs kill` with the pattern in the same
> command line either), walks in round-robin batches of at most 20 routes, fuzz afterwards
> one area at a time, screenshots after the walks never during, Read every screenshot,
> push only after the full verification passes. Agents that stop "waiting for a
> notification" are resumed with: do not wait, read the output file, finish.

Also on the tzadek.ai side: the synthesis max_tokens is 1600 and rabbi answers 1200 (Hebrew
rulings were cut off at 800); the landing page has a walkthrough section
(`web/public/index.html`, images in `web/public/img/`); the web service does not auto-deploy
from GitHub; the Railway CLI token expires daily (`! railway login`). Retrieval eval sits
at 134-136/143 (see `v3/TODO.md`).

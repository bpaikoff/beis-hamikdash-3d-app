# Starter prompt for the next session

Paste this (or point Claude at it) to resume:

> Working in `~/prod/beis-hamikdash-3d-app` (master, deployed to
> https://beis-hamikdash-3d-production.up.railway.app and, once the Cloudflare CNAME is
> in, https://mikdash.tzadek.ai) and `~/prod/tzadek_ai` (branch `prod`). Read `CLAUDE.md`
> in the 3D repo for how rounds run, then `docs/backlog.md` for the open items and
> `docs/content.md`'s review log (2026-09-09, Round 6) for the last round's reasoning.
>
> State on 2026-09-09: six sprints and six rounds merged. Round 6 built the Middot 1:9
> passage from Beis HaMoked's north-west chamber (well, three flights, vaulted lamp-lit
> corridor, bath-house with a sunken pool) and Shaar HaNitzotz's stair tower and wicket to
> the Cheil; the `?at=` spawn picker (`src/game/spawn.js`); the ground normal map fading
> with distance; the muchni post clear of (-27,-65); brighter gold panels; a cloth-fold
> normal map on the garments, a Levite role with a flat turban, a sudar that covers the
> skull, goats with horns, the Quaternius Bull. 88 walk routes and fuzz on all five areas
> pass; 348 vitest tests; hero ~1012 draw calls under the 1200 budget.
>
> Pick from the backlog, in this order unless told otherwise:
> 1. Decide the Avtinas / Palhedrin flip: the source reviewer read Yoma 19a as leaving the
>    north/south question open, with Rambam (Beis HaBechirah 5:17), Meiri and Yerushalmi
>    Yoma 1:5 putting Beis Avtinas over the Water Gate in the south and Palhedrin north as
>    Lishkas HaEtz. The notes say so; the geometry still follows the rejected reading. If
>    flipping: Avtinas becomes the aliyah over `water_gate` with its stair tower moved,
>    Palhedrin returns beside Lishkas HaEtz (its old dispute entry has the positions).
> 2. A notch in `HarHaBayisBuilder`'s mount and Cheil slabs so the Middot 1:9 passage and
>    bath can sink below the pavement ("under the Birah"); open the seal between the
>    vestibule's west bay and the Cheil door so the tamei kohen's way to Tadi is direct.
> 3. Hand-placed `cam` views for `ulam_facade` (square-on) and `?at=pesach_haheichal`; a
>    Flame.js flame for the passage lamps.
> 4. Small visual leftovers in `docs/backlog.md` (`?at=lishkas_haetz` sees only back walls;
>    Bechoros/Delek/Nitzotz 30 degrees off axis).
>
> Constraints that still hold: surgical edits to `temple.json`, worktree per agent, commit
> per milestone, no `pkill -f`, walks in batches of at most 22 routes (batch C tripped the
> 15-minute watchdog at 22 with the long Har HaBayis routes; split those), fuzz afterwards
> one area at a time, Read every screenshot, push only after the full verification passes.
> Agents that stop "waiting for a notification" are resumed with: do not wait, read the
> output file, finish.

Also open on the tzadek.ai side (see `~/prod/tzadek_ai/v3/TODO.md` and the memory note
`retrieval_eval_and_classifier.md`): retrieval eval sits at 134-136/143 with the
classifier seed variance narrowed to ±1; persona misattribution is judge noise at ~2
rows per 150 and is not worth further prompt work. The retrieval service redeploys on
every push to `prod` unless a watch path `/v3` is set in the Railway dashboard.

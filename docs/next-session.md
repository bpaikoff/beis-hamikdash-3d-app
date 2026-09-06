# Starter prompt for the next session

Paste this (or point Claude at it) to resume:

> Working in `~/prod/beis-hamikdash-3d-app` (master, deployed to
> https://beis-hamikdash-3d-production.up.railway.app) and `~/prod/tzadek_ai` (branch
> `prod`). Read `CLAUDE.md` in the 3D repo for how rounds run, then `docs/backlog.md` for
> the open items and `docs/content.md`'s review log for the last round's reasoning.
>
> State on 2026-09-06: all six sprints, three content rounds and the Cheil stairs are
> merged; 70 walk routes and fuzz on all 7 areas pass; 238 vitest tests; hero view 945
> draw calls under the 1200 CI budget. Verification recipe and the agent-round pattern
> are in `CLAUDE.md` (content + geometry agents in parallel, then walkers, then a source
> reviewer and a code reviewer, ≤ 3 agents at once).
>
> Pick from the backlog, in this order unless told otherwise:
> 1. Visual fidelity a visitor notices first: the flat pyramid hills (a real terrain
>    mesh or a skyline), the untextured Ulam steps, the Tadi gate's lintel box (Middot
>    2:3: two leaning stones, no lintel), non-colliding benches and the kiyor rim.
> 2. Characters: replace the mannequin kohanim with a textured rigged human (the
>    Quaternius Universal Base Characters download was blocked; try again or another CC0
>    source), keep `CharacterSystem`'s API, add a distance LOD for skinned meshes.
> 3. Content still unresolved: the Middot 1:9 mikveh passage from Beis HaMoked's
>    north-west chamber, Shaar HaNitzotz's wicket to the Cheil, and a second reader for
>    the Yoma 19a Avtinas/Palhedrin assignment.
> 4. Sky: a sky-based PMREM so dawn and dusk reach the stone in the hero view.
> 5. When the app is "closer to perfect": DNS for mikdash.tzadek.ai (CNAME `mikdash` ->
>    `4bae3oiu.up.railway.app`) and the tzadek.ai landing page link.
>
> Constraints that still hold: surgical edits to `temple.json`, worktree per agent, commit
> per milestone, no `pkill -f`, walks in batches with fuzz afterwards, Read every
> screenshot, push only after the full verification passes.

Also open on the tzadek.ai side (see `~/prod/tzadek_ai/v3/TODO.md` and the memory note
`retrieval_eval_and_classifier.md`): retrieval eval sits at 134-136/143 with the
classifier seed variance narrowed to ±1; persona misattribution is judge noise at ~2
rows per 150 and is not worth further prompt work.

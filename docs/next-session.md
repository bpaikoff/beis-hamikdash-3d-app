# Starter prompt for the next session

Paste this (or point Claude at it) to resume:

> Working in `~/prod/beis-hamikdash-3d-app` (master, deployed to
> https://beis-hamikdash-3d-production.up.railway.app) and `~/prod/tzadek_ai` (branch
> `prod`). Read `CLAUDE.md` in the 3D repo for how rounds run, then `docs/backlog.md` for
> the open items and `docs/content.md`'s review log for the last round's reasoning.
>
> State on 2026-09-06 (night): all six sprints, five rounds and the Cheil stairs are
> merged; 72 walk routes and fuzz on all areas pass; ~260 vitest tests; hero view ~945 draw
> calls under the 1200 CI budget. Round 4 closed the first-impression items (heightfield
> hills with a Har HaMishcha ridge, Tadi's gable, Ulam steps, solid benches, kiyor kerb,
> compass). Round 5 replaced the mannequin kohanim with the textured Universal Base
> Characters body on the same rig (skin/garment material groups, tube-normal robes, a
> skinned LOD) and made the environment map a per-time PMREM of the sky. Verification
> recipe and the agent-round pattern are in `CLAUDE.md`.
>
> Pick from the backlog, in this order unless told otherwise:
> 1. Content still unresolved: the Middot 1:9 mikveh passage from Beis HaMoked's
>    north-west chamber, Shaar HaNitzotz's wicket to the Cheil, and a second reader for
>    the Yoma 19a Avtinas/Palhedrin assignment.
> 2. Characters, second pass (`docs/backlog.md`): a tunic mesh with folds or a garment
>    normal map instead of paint over the body; a Levite role with its own cap for the
>    Duchan; goat and bull models.
> 3. Small visual leftovers: the sand normal map's ripple on the near hills, the
>    `ulam_facade` view spawning on the altar top, the muchni post pinning a `?cam=` start
>    at (-27, -65), the gold burnish under the sky environment (the sun panels are the knob).
> 4. When the app is "closer to perfect": DNS for mikdash.tzadek.ai (CNAME `mikdash` ->
>    `4bae3oiu.up.railway.app`) and the tzadek.ai landing page link.
>
> Constraints that still hold: surgical edits to `temple.json`, worktree per agent, commit
> per milestone, no `pkill -f`, walks in batches with fuzz afterwards, Read every
> screenshot, push only after the full verification passes.

Also open on the tzadek.ai side (see `~/prod/tzadek_ai/v3/TODO.md` and the memory note
`retrieval_eval_and_classifier.md`): retrieval eval sits at 134-136/143 with the
classifier seed variance narrowed to ±1; persona misattribution is judge noise at ~2
rows per 150 and is not worth further prompt work.

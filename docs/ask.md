# Ask the poskim (live answers from tzadek.ai)

Every hotspot card ends with a few questions. Clicking one opens the **Ask
panel** (`src/components/AskPanel.jsx`), which streams an answer from the
tzadek.ai poskim into the HUD: one card per rabbi persona (three eras in quick
mode), each with its sources and its psak, then a synthesis with the consensus
level. The foot of the panel has a free-text box for another question and a
"Continue on tzadek.ai" link that carries the question to the full app.

The small `↗` beside each card question is the same question on tzadek.ai
itself. It is the only path when live answers are not configured in the build.

## How it works

`src/lib/tzadek.js` is the client (no React, unit tested in
`src/lib/tzadek.test.js`):

```js
import { askStream, isAskAvailable } from '../lib/tzadek.js';

isAskAvailable(); // true when the build carries a guest passcode

const stream = askStream(
  { question, language: 'en' | 'he', quick: true },
  {
    onUnavailable({ unavailable, message }) {}, // nopasscode | auth | forbidden | limit | budget | rate | network | http | unsupported
    onStart({ rabbis, backend, quickMode }) {},
    onClassified({ mode, queryType, halachicArea }) {},
    onRabbiStart({ key, name, nameEn, era, emoji }) {},
    onSources({ rabbiKey, count, refs }) {},
    onRabbiChunk({ rabbiKey, text }) {},
    onRabbiComplete({ rabbiKey, answer, sources, mode, isHalachic }) {},
    onSynthesisStart({ consensus: { level }, synthesisType }) {},
    onSynthesisChunk({ text }) {},
    onSynthesisComplete({ synthesis, synthesisType }) {},
    onComplete() {},
    onError({ message }) {},
  }
);
stream.close(); // stop early; handlers go quiet
```

The sequence per question:

1. `POST {base}/api/auth/stream-token` with the header `X-Passcode: <guest
   passcode>` and an empty JSON body. The reply is a single-use token (2 min
   TTL). No cookies are involved (`credentials` is never set).
2. `new EventSource({base}/api/ask/stream?token=…&question=…&language=en|he&quickMode=true)`.
   Events arrive as JSON with a `type` field (`start`, `classified`,
   `rabbi_start`, `tool_call`, `rabbi_chunk`, `rabbi_complete`,
   `synthesis_start`, `synthesis_chunk`, `synthesis_complete`, `complete`,
   `error`). `complete` closes the source; the browser's reconnect attempt that
   follows is ignored.
3. Budget and rate-limit refusals come back on the token POST as 401/403/429
   JSON and reach the panel as `onUnavailable`; the panel then shows the
   message and the tzadek.ai link. Failures during the stream (`error` event,
   dropped connection, 90 s without an event) reach `onError` and the panel
   offers a retry.

Only one stream runs per browser tab: a new question closes the previous
stream. Halachic answers end with a `Psak: permitted|forbidden|dispute|depends`
line (Hebrew `פסק: מותר|אסור|מחלוקת|תלוי`); `parsePsak` lifts it off the
text and the panel renders it as a green/red/orange/amber pill, matching
tzadek.ai. The `language` parameter follows the HUD language (`store.lang`)
at the moment of asking; answers are laid out right-to-left when they are
Hebrew.

Store fields (`src/store.js`): `askOpen`, `askQuestion`, `askSeq`, with the
helpers `openAsk(question)` and `closeAsk()`. Opening the panel releases the
pointer lock and hides the "click to look around" overlay; Escape closes it
(captured before the hotspot card's own Escape, so the card stays open).
Keys typed in the question box and clicks inside the panel are stopped before
they reach the game's movement and click-to-lock listeners.

## Environment variables (build time)

Vite inlines these at `npm run build`; changing them means rebuilding.

| Variable | Purpose |
|---|---|
| `VITE_TZADEK_GUEST_PASSCODE` | The guest passcode the panel sends as `X-Passcode`. Unset: the panel only shows the tzadek.ai link ("Live answers are not enabled in this build"). |
| `VITE_TZADEK_BASE` | tzadek.ai origin, default `https://tzadek.ai`. Point it at a staging server for local work. |

Railway: set both on the 3D service (Variables tab). `Dockerfile` declares
them as `ARG`s so Railway's Docker build receives them. Locally:

```bash
VITE_TZADEK_GUEST_PASSCODE=MK-xxxx npx vite
```

The passcode is public by construction (it ships in the JavaScript bundle);
that is why the record behind it is a guest user restricted to asking, with
its own token budget. Nothing else on tzadek.ai can be reached with it.

`nginx.conf` already lists `https://tzadek.ai` under `connect-src` in the CSP
(both the token POST and the EventSource are `connect-src`); no `img-src` or
`font-src` entries are needed because the panel loads nothing else from
tzadek.ai. A different `VITE_TZADEK_BASE` needs its origin added there too.

## Limits

Enforced on the tzadek.ai side; the panel only reports them:

- **Per guest user:** 6 questions per minute (429 `Too many questions, please
  slow down.`), and a monthly token cap on the guest record (`tokenLimit`,
  2,000,000 tokens; 429 `Monthly token limit exceeded` with `tokensUsed` and
  `tokenLimit`). The cap resets monthly with the rest of tzadek.ai's usage
  accounting.
- **Per IP:** 10 token requests per minute across all passcodes.
- **Global budget:** when tzadek.ai's overall spend limit is hit, the token POST
  answers 429 with `budgetExceeded: true`.
- **Per tab:** one stream at a time; the client drops a stream after 90 s
  without an event.

Quick mode (`quickMode=true`) asks three of the five personas (Geonim,
Shulchan Aruch, contemporary), which roughly halves the tokens per question.
The panel always uses quick mode; the "Continue on tzadek.ai" link is the way
to the full five-era answer.

## Rotating the passcode

1. On tzadek.ai (repo `tzadek_ai`, web service): set a new `MIKDASH_PASSCODE`
   in the Railway variables and redeploy (`cd web && railway up` from
   `~/prod/tzadek_ai`). The server re-seeds the `mikdash_seed` guest user with
   the new passcode; the old one stops working at once.
2. On the 3D service: set `VITE_TZADEK_GUEST_PASSCODE` to the new value and
   trigger a redeploy (push to `master` or "Redeploy" in the dashboard). Until
   the new build is live the panel shows "The visitor passcode was not
   accepted" with the tzadek.ai link, so nothing breaks hard.
3. Check: open any card question in the deployed app and confirm an answer
   streams; `curl -X POST https://tzadek.ai/api/auth/stream-token -H 'X-Passcode: <old>' -H 'Content-Type: application/json' -d '{}'`
   must answer 401.

To check the guest user's spend, use the tzadek.ai admin usage view (the
guest passcode itself cannot read usage).

## Visual check without tzadek.ai

```bash
npx vite --port 5190 --strictPort &                       # VITE_TZADEK_GUEST_PASSCODE unset
node scripts/shot_ask.mjs --base http://localhost:5190 --out shots/ask_unavailable.png
node scripts/shot_ask.mjs --mobile --base http://localhost:5190 --out shots/ask_unavailable_mobile.png
```

The script opens the altar card, clicks its first question and captures the
panel in its unavailable state; it logs any request to tzadek.ai as
unexpected. Unit tests never touch the network either.

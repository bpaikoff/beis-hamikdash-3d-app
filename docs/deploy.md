# Deploying to Railway (mikdash.tzadek.ai)

The explorer is a static Vite build. `Dockerfile` builds it with Node 22 and
serves `dist/` with nginx; `nginx.conf` is the site template (rendered at
container start with `$PORT`, default 8080, by `docker-entrypoint.sh`);
`railway.json` tells Railway to use that Dockerfile.

## 1. Create the Railway service

1. In the Railway dashboard open the **TzadekAI** project (or a new one) and
   choose **New -> GitHub Repo -> `bpaikoff/beis-hamikdash-3d`** (this repo).
2. Settings -> Source:
   - **Root directory:** `/` (repo root; `Dockerfile` and `railway.json` live there).
   - **Branch:** `master`. Every push to `master` redeploys.
3. Settings -> Build: Railway reads `railway.json` and uses the `DOCKERFILE`
   builder automatically; nothing else to set. No environment variables are
   required. Railway injects `PORT`; the container honours it.
4. Settings -> Deploy: `healthcheckPath` is `/healthz` (from `railway.json`).
   Leave the start command empty (the image's entrypoint starts nginx).
5. Deploy once and confirm the Railway-generated `*.up.railway.app` URL loads.

Merging requires a green CI run (`.github/workflows/ci.yml`: lint, tests,
build, screenshots). Do not merge to `master`, and therefore do not deploy,
while CI is red.

## 2. Custom domain

1. Service -> Settings -> Networking -> **Custom Domain** -> `mikdash.tzadek.ai`.
   Railway shows a CNAME target (something like `xxxx.up.railway.app`).
2. At the DNS host for `tzadek.ai` (Cloudflare), add **both** records Railway shows.
   The dashboard shows them together; the GraphQL `domains` query lists only the
   CNAME, the TXT is in `customDomains.status.verificationDnsHost` /
   `verificationToken`. Without the TXT the domain stays `verified: false`, the
   certificate sits in "validating ownership" indefinitely and Railway's edge answers
   `{"message":"Application not found"}` for the host (2026-09-09: twelve hours lost
   to this).

   ```
   mikdash                  CNAME   <target shown by Railway, e.g. ujdxqm65.up.railway.app>
   _railway-verify.mikdash  TXT     railway-verify=<token shown by Railway>
   ```

   Re-adding the domain in Railway changes the CNAME target and the token. Once both
   records resolve, `mutation { customDomainIssueCertificate(id: "<customDomain id>") }`
   on the GraphQL API verifies and issues at once instead of waiting for Railway's poll.

   If the DNS host proxies traffic (e.g. Cloudflare orange cloud), set the
   record to DNS-only until Railway has issued the certificate, then proxy if
   desired.
3. Wait for Railway to report the domain as verified with a certificate
   (usually a few minutes after DNS propagates).

## 3. tzadek.ai side

Two changes in the `tzadek_ai` repo (web server) let the explorer talk to
tzadek.ai:

- `web/server.js`: `https://mikdash.tzadek.ai` is an accepted CORS origin.
- `web/public/app.html`: `https://tzadek.ai/app?q=<question>` prefills the
  question box (the user still presses Ask).

Those must be deployed to the tzadek.ai web service (`cd web && railway up`
from `~/prod/tzadek_ai`) for the CORS check below to pass.

## 4. Verify

```bash
# Health probe (Railway uses this too)
curl -sS https://mikdash.tzadek.ai/healthz          # -> ok

# index.html is never cached stale
curl -sI https://mikdash.tzadek.ai/index.html | grep -i cache-control
#   Cache-Control: no-cache

# Hashed assets are immutable (take a real hash from the page source)
HASH_JS=$(curl -sS https://mikdash.tzadek.ai/ | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -sI "https://mikdash.tzadek.ai$HASH_JS" | grep -i cache-control
#   Cache-Control: public, max-age=31536000, immutable

# gzip is on for JS
curl -sI -H 'Accept-Encoding: gzip' "https://mikdash.tzadek.ai$HASH_JS" | grep -i content-encoding
#   Content-Encoding: gzip

# SPA fallback: unknown paths return index.html with 200
curl -sI https://mikdash.tzadek.ai/some/deep/route | head -1
#   HTTP/2 200

# Security headers
curl -sI https://mikdash.tzadek.ai/ | grep -iE 'x-content-type-options|referrer-policy|content-security-policy'

# tzadek.ai accepts the explorer as a CORS origin
curl -sI -H 'Origin: https://mikdash.tzadek.ai' https://tzadek.ai/api/health | grep -i access-control-allow-origin
#   Access-Control-Allow-Origin: https://mikdash.tzadek.ai
```

## Local check without Railway

```bash
docker build -t mikdash .
docker run --rm -p 8080:8080 mikdash            # default port
docker run --rm -e PORT=3000 -p 3000:3000 mikdash
curl -sI localhost:8080/index.html | grep -i cache-control
```

Without Docker, `npm run build` plus
`PORT=8080 envsubst '${PORT}' < nginx.conf` shows the rendered config; the
directive/context syntax can be checked with `crossplane parse --strict`
(pip package from nginx) if `nginx -t` is unavailable.

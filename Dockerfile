# Beis HaMikdash 3D explorer — static Vite build served by nginx.
#
# Stage 1: build the site with Node 22 (matches .nvmrc / engines).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve dist/ with nginx. Railway injects $PORT; the entrypoint
# renders nginx.conf (a template) with that value, defaulting to 8080.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.d/99-render-port.sh
RUN chmod +x /docker-entrypoint.d/99-render-port.sh \
    && rm -f /etc/nginx/conf.d/default.conf
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
# nginx:alpine's stock entrypoint runs every script in /docker-entrypoint.d/
# and then execs nginx in the foreground.

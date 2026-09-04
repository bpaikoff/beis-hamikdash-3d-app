#!/bin/sh
# Render /etc/nginx/default.conf.template into
# /etc/nginx/conf.d/default.conf, substituting only ${PORT} so nginx's own
# $uri / $host variables survive untouched. Runs from /docker-entrypoint.d/
# before nginx starts (the nginx:alpine image handles that ordering).
set -eu
export PORT="${PORT:-8080}"
envsubst '${PORT}' \
  < /etc/nginx/default.conf.template \
  > /etc/nginx/conf.d/default.conf
echo "nginx: rendered default.conf, listening on port ${PORT}"

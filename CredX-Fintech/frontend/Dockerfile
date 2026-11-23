# syntax=docker/dockerfile:1

# ---- build the static bundle ---------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public, non-secret build-time setting: where the browser sends API calls.
# The default "/api" is proxied to the backend by nginx below.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- serve with nginx ----------------------------------------------------------------
FROM nginx:1.28-alpine
# Rendered into /etc/nginx/conf.d/default.conf at start-up (envsubst).
ENV BACKEND_URL=http://backend:5000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

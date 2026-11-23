# syntax=docker/dockerfile:1

# ---- dependencies --------------------------------------------------------------
# Debian (glibc) base: the local embedding runtime (onnxruntime-node) ships
# no musl/Alpine binaries.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# Skip onnxruntime's optional CUDA download (CPU inference only).
ENV NODE_ENV=production \
    ONNXRUNTIME_NODE_INSTALL=skip
# WITH_EMBEDDINGS=false leaves out the optional local embedding model runtime;
# the assistant then uses its deterministic hashing embedder.
ARG WITH_EMBEDDINGS=true
COPY package.json package-lock.json ./
RUN if [ "$WITH_EMBEDDINGS" = "true" ]; then npm ci --omit=dev; else npm ci --omit=dev --omit=optional; fi \
    && npm cache clean --force

# ---- runtime ----------------------------------------------------------------------
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    EMBEDDINGS_CACHE_DIR=/app/.model-cache
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
# The embedding model is downloaded on first use into this (volume-mounted) cache.
RUN mkdir -p /app/.model-cache && chown node:node /app/.model-cache
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "src/server.js"]

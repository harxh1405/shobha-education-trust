# ==============================================================================
# All-in-One Multi-Stage Dockerfile (Single-Container Fullstack Deployment)
# Suitable for Render, Railway, Fly.io, Heroku, AWS App Runner, DigitalOcean
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the Vite production bundle
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY index.html ./
COPY about.html ./
COPY campus.html ./
COPY admissions.html ./
COPY programmes.html ./
COPY institutions.html ./
COPY community.html ./
COPY contact.html ./
COPY news.html ./
COPY student-corner.html ./
COPY fee-payment.html ./
COPY fee-payment-status.html ./
COPY admin/ ./admin/
COPY css/ ./css/
COPY js/ ./js/
COPY images/ ./images/
COPY assets/ ./assets/
COPY vite.config.js ./

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Server Runtime (Node.js API + Static Distribution)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS app-runner

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy backend application code
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY assets/ ./assets/

# Copy compiled frontend from builder
COPY --from=frontend-builder /app/dist ./dist

# Create persistent data directories
RUN mkdir -p /app/data/uploads /app/data/db

ENV NODE_ENV=production \
    PORT=5001 \
    UPLOAD_DIR=data/uploads

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5001/api/health || exit 1

CMD ["node", "server/server.js"]

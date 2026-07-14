# =============================================================================
#  prerender-manager — production image
#
#  Based on the official Playwright image so Chromium + all its system
#  libraries are already present (needed both by the clone.js pre-render
#  script and by the live obsolescence check).
# =============================================================================
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS base
WORKDIR /app

# The Vercel CLI is invoked (via child_process) to deploy each static clone.
RUN npm install -g vercel@latest

# --- dependencies ------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# --- build -------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Chromium lives in the base image; point Playwright at it and don't re-download.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/scripts ./scripts

# Runtime state (sites config, cloned output, logs) — mount as a volume.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["npm", "run", "start"]

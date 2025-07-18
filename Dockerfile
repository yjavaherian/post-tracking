# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm

# ---- Dependencies ----
FROM base AS deps
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY . .
RUN pnpm run build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/build ./build
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# Add files needed for runtime database migrations
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/drizzle ./drizzle

# Create data directory for the database
RUN mkdir -p /app/data

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app/data
USER appuser

VOLUME /app/data

EXPOSE 3000

CMD ["node", "build/index.js"] 

# Stage 1: Build frontend
FROM oven/bun:1.0.30-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files
COPY package.json bun.lock ./
COPY client/package.json client/bun.lock* ./client/

# Install dependencies
RUN bun install
WORKDIR /app/client
RUN bun install
WORKDIR /app

# Copy source code
COPY . .

# Build frontend
WORKDIR /app/client
RUN bun run build

# Stage 2: Production image
FROM oven/bun:1.0.30-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    git \
    python3 \
    npm \
    curl

# Copy backend dependencies
COPY package.json bun.lock ./
RUN bun install --production

# Copy built frontend from builder
COPY --from=builder /app/client/dist ./client/dist

# Copy server and bin directories
COPY server ./server
COPY bin ./bin

# Create directories for runtime
RUN mkdir -p /app/.openui && \
    chmod 755 /app/bin/openui.ts

# Expose ports
# 6968: Backend server + WebSocket
EXPOSE 6968

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:6968/api/config || exit 1

# Set environment defaults
ENV NODE_ENV=production \
    PORT=6968 \
    OPENUI_QUIET=1

# Run the server
CMD ["bun", "run", "server/index.ts"]

# Stage 1: Build frontend (Alpine is fine for building)
FROM oven/bun:1.3-alpine AS builder

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

# Stage 2: Production image (Debian for glibc compatibility with bun-pty)
FROM oven/bun:1.3-debian

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js using NodeSource (more reliable than Debian npm)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install AI Agent CLI tools globally via npm
RUN npm install -g @anthropic-ai/claude-code opencode-ai

# Install Ralph (autonomous Claude Code loop)
RUN git clone --depth 1 https://github.com/frankbria/ralph-claude-code.git /opt/ralph && \
    chmod +x /opt/ralph/install.sh && \
    cd /opt/ralph && ./install.sh || true && \
    ln -sf /opt/ralph/ralph /usr/local/bin/ralph && \
    ln -sf /opt/ralph/ralph-setup /usr/local/bin/ralph-setup

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
CMD ["bun", "run", "/app/server/index.ts"]

# OpenUI

**Your AI Agent Command Center**

Manage multiple AI coding agents working in parallel on an infinite canvas. See what each agent is working on, their status, and jump in when they need help.

## The Problem

You want to run 8 Claude agents simultaneously - each working on a different ticket, in isolated branches. But:
- Terminal tabs are chaos
- You can't see who's stuck at a glance
- Context switching is painful
- No way to organize by project/team

## The Solution

OpenUI gives you a visual command center where each agent is a node on a canvas:

- **At-a-glance status**: See which agents are working, idle, or need input
- **Ticket integration**: Start sessions from Linear tickets (more integrations coming)
- **Branch isolation**: Each agent works in its own git worktree
- **Real-time metrics**: Cost, context usage, lines changed per agent
- **Organized workspace**: Categories, custom colors, drag-and-drop layout

## Installation

```bash
# Install globally
npm install -g @fallom/openui
openui

# Or run without installing
npx @fallom/openui
bunx @fallom/openui
```

## Quick Start

1. Run `openui` in your project directory
2. Browser opens at `http://localhost:6969`
3. Click "+" to spawn agents (Claude Code or OpenCode)
4. Click any node to open its terminal
5. Drag nodes to organize, create categories to group them

## Features

### Canvas Management
- Infinite canvas for organizing agents
- Drag-and-drop positioning with snap-to-grid
- Categories (folders) for grouping agents by team/project with persistent sizing
- Custom names, colors, and icons per agent
- Persistent layout across restarts

### Agent Monitoring
- Real-time status: Starting, Running, Idle, Needs Input, Tool Calling
- Claude metrics: Model, cost, context %, tokens, lines changed
- Git branch display per agent
- Directory/repo info
- Redesigned node cards for better at-a-glance visibility

### Session Management
- Spawn multiple agents at once (placed in horizontal row beside existing nodes)
- Restart sessions with custom arguments
- Session persistence and restore
- Version check and empty state UI

### Coming Soon: Linear Integration
- Start sessions directly from Linear tickets
- Auto-create isolated branches per ticket
- Git worktree support for parallel work
- Ticket info displayed on agent nodes

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                    OpenUI Canvas                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Agent 1 │  │ Agent 2 │  │ Agent 3 │             │
│  │ PROJ-12 │  │ PROJ-34 │  │  IDLE   │             │
│  │ Working │  │ Waiting │  │         │             │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                      │
│  ┌─ Frontend Team ──────────────────────┐           │
│  │  ┌─────────┐  ┌─────────┐           │           │
│  │  │ Agent 4 │  │ Agent 5 │           │           │
│  │  └─────────┘  └─────────┘           │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

OpenUI runs a local server that:
- Spawns PTY sessions for each AI agent
- Tracks agent state via terminal output parsing
- Streams terminal I/O over WebSocket
- Persists everything to `.openui/` in your project

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono + WebSockets + bun-pty
- **Frontend**: React + React Flow + xterm.js + Framer Motion
- **State**: Zustand

## Development

```bash
git clone https://github.com/anthropics/openui.git
cd openui

bun install
cd client && bun install && cd ..

bun run dev  # Server on 6968, UI on 6969
```

## Requirements

- Bun 1.0+
- One of: Claude Code, OpenCode (or any terminal-based AI agent)

## License

MIT

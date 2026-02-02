# OpenUI

**Your AI Agent Command Center**

Manage multiple AI coding agents working in parallel on an infinite canvas. See what each agent is working on, their status, and jump in when they need help.

## The Problem

You want to run 8 Claude agents simultaneously - each working on different tasks, in isolated branches. But:
- Terminal tabs are chaos
- You can't see who's stuck at a glance
- Context switching is painful
- No way to organize by project/team

## The Solution

OpenUI gives you a visual command center where each agent is a node on a canvas:

- **At-a-glance status**: See which agents are working, idle, or need input
- **GitHub integration**: Start sessions from GitHub issues with automatic branch creation
- **Branch isolation**: Each agent works in its own git worktree
- **Organized workspace**: Tabs, custom colors, drag-and-drop layout
- **Auto-resume**: Sessions automatically restore on restart
- **Archive management**: Archive completed sessions while keeping your workspace clean

## Installation

### For Databricks (Internal Use)

**Development Mode:**
```bash
# Clone the fork
git clone https://github.com/JJ27/openui.git
cd openui

# Install dependencies
bun install
cd client && bun install && cd ..

# Run in development mode (starts on port 6969)
bun run dev
```

**Production Mode (Recommended):**
```bash
# Clone and install
git clone https://github.com/JJ27/openui.git
cd openui
bun install
cd client && bun install && cd ..

# Link globally
bun link

# Now you can run openui from any directory
cd ~/your-project
openui
```

Then forward port 6969 from your dev machine to access the UI locally.

**Prerequisites:**
- `bun` - Install with: `curl -fsSL https://bun.sh/install | bash`
- `llm agent` - Claude Code agent interface (already available on Databricks dev machines)

### Public Installation

```bash
# Install globally
npm install -g @fallom/openui
openui

# Or run without installing
npx @fallom/openui
bunx @fallom/openui
```

## Quick Start

1. Run `openui` (or `bun run dev` for development) in your project directory
2. Browser opens at `http://localhost:6969`
3. Click "+" to spawn agents (Claude Code, OpenCode, or Ralph Loop)
4. Click any node to open its terminal
5. Drag nodes to organize, create tabs to group them

## Features

### Canvas Management
- **Infinite canvas** for organizing agents with drag-and-drop positioning
- **Tabs**: Create multiple canvases to organize agents by project, team, or workflow
- **Custom styling**: Set custom names, colors, and icons per agent
- **Persistent layout**: All positions and organization saved across restarts
- **Auto-center**: Automatically centers canvas when switching views

### Agent Monitoring
- **Real-time status**: Running, Idle, Needs Input, Tool Calling, Disconnected
- **Git integration**: Branch and repo info displayed on each node
- **Directory tracking**: See working directory per agent
- **Session count**: Active agent count displayed in header (excludes archived)

### Session Management
- **Auto-resume**: Sessions automatically restore on server restart with proper state
- **Manual resume**: Resume disconnected sessions with preserved context
- **Bulk spawn**: Create multiple agents at once (placed in horizontal row)
- **Session persistence**: All sessions saved to `.openui/state.json`
- **Archive**: Archive completed sessions to keep workspace clean while preserving history
- **Custom restart**: Restart sessions with modified commands or arguments

### GitHub Integration
- Start sessions directly from GitHub issues
- Auto-create isolated branches per issue
- Git worktree support for parallel work on different issues
- Issue info (ID, title) displayed on agent nodes
- Issue URL linking

### Claude Code Plugin (Auto-installed)

OpenUI automatically installs a Claude Code plugin that provides:
- **Precise status tracking**: Detect Working, Using Tools, Idle, Waiting for Input via hooks
- **Session ID capture**: Enables proper session resume with `--resume <session_id>`
- **Status updates**: WebSocket-based real-time status updates to OpenUI

No manual installation required - just run `openui` and the plugin is set up automatically.

See [claude-code-plugin/README.md](./claude-code-plugin/README.md) for more details.

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                   OpenUI Canvas                      │
│  ┌─ Tab: Frontend ─┐  ┌─ Tab: Backend ─┐            │
│  │                  │  │                 │            │
│  │  ┌─────────┐    │  │  ┌─────────┐   │            │
│  │  │ Agent 1 │    │  │  │ Agent 3 │   │            │
│  │  │ #123    │    │  │  │  IDLE   │   │            │
│  │  │ Working │    │  │  └─────────┘   │            │
│  │  └─────────┘    │  │                 │            │
│  │                  │  └─────────────────┘            │
│  │  ┌─────────┐    │                                  │
│  │  │ Agent 2 │    │                                  │
│  │  │ #124    │    │                                  │
│  │  │ Waiting │    │                                  │
│  │  └─────────┘    │                                  │
│  │                  │                                  │
│  └──────────────────┘                                 │
└─────────────────────────────────────────────────────┘
```

OpenUI runs a local server that:
- Spawns PTY sessions for each AI agent
- Tracks agent state via Claude Code plugin hooks
- Streams terminal I/O over WebSocket
- Persists everything to `.openui/` in your project
- Auto-resumes sessions on restart with proper state

### Agent Commands

By default, OpenUI uses `llm agent claude` to spawn Claude Code instances. This works seamlessly with:
- Session resume via `--resume <session_id>`
- Plugin injection via `--plugin-dir`
- All standard Claude Code features

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono + WebSockets + bun-pty
- **Frontend**: React + React Flow + xterm.js + Framer Motion
- **State**: Zustand
- **Terminal**: xterm.js with fit addon and web links

## Development

```bash
git clone https://github.com/JJ27/openui.git
cd openui

bun install
cd client && bun install && cd ..

bun run dev  # Server on 4242, UI on 6969
```

### Project Structure

```
openui/
├── server/           # Backend (Hono + WebSocket + PTY management)
│   ├── routes/       # API routes
│   ├── services/     # Session, persistence, auto-resume logic
│   └── types/        # TypeScript types
├── client/           # Frontend (React + React Flow)
│   └── src/
│       ├── components/  # React components
│       ├── stores/      # Zustand state management
│       └── App.tsx
├── claude-code-plugin/  # Claude Code plugin for status tracking
└── .openui/          # Runtime data (created in working directory)
    ├── state.json    # Persisted sessions and canvas state
    └── claude-code-plugin/  # Auto-installed plugin
```

### Testing with the Claude Code Plugin

For development, OpenUI automatically loads the plugin from the repo's `claude-code-plugin/` directory if present. Just run `bun run dev` and the plugin will be injected when spawning Claude agents.

You can also test manually:
```bash
llm agent claude --plugin-dir $(pwd)/claude-code-plugin
```

## Requirements

- **Bun 1.0+**: JavaScript runtime and package manager
- **Claude Code**: Available via `llm agent claude` (Databricks) or `claude` (public)
  - For Databricks: Already installed on dev machines
  - For public: Install from [claude.com/claude-code](https://claude.com/claude-code)

### Optional: Ralph Loop

[Ralph](https://github.com/frankbria/ralph-claude-code) is an autonomous development loop that runs Claude Code repeatedly until all tasks are complete. To use it with OpenUI:

```bash
# Install Ralph globally
git clone https://github.com/frankbria/ralph-claude-code.git
cd ralph-claude-code
./install.sh

# In your project, set up Ralph
cd your-project
ralph-setup .

# Then select "Ralph Loop" when creating an agent in OpenUI
```

Ralph includes rate limiting, circuit breakers, and intelligent exit detection to prevent runaway loops.

## Configuration

### Git Worktrees

When starting sessions from GitHub issues, OpenUI can automatically create git worktrees for branch isolation:

- Each issue gets its own worktree in `../<repo>-<branch-name>/`
- Agents work independently without affecting your main worktree
- Automatically cleans up on session archive

## Troubleshooting

### Sessions show "disconnected"
- Check that `llm agent claude` works in your terminal
- Ensure the Claude Code plugin is installed (should be automatic)
- Click the "Resume" button to restart the session

### Port already in use
- Change the port in `server/index.ts` or kill the process using port 6969

### Plugin not working
- Delete `~/.openui/claude-code-plugin/` and restart OpenUI to reinstall
- Check plugin logs in the terminal output

## License

MIT

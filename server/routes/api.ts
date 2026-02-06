import { Hono } from "hono";
import type { Agent } from "../types";
import { sessions, createSession, deleteSession, injectPluginDir } from "../services/sessionManager";
import { loadState, saveState, savePositions, getDataDir, loadCanvases, saveCanvases, migrateCategoriesToCanvases } from "../services/persistence";
import { enqueueSessionStart, signalSessionReady } from "../services/sessionStartQueue";

const LAUNCH_CWD = process.env.LAUNCH_CWD || process.cwd();
const QUIET = !!process.env.OPENUI_QUIET;
const log = QUIET ? () => {} : console.log.bind(console);
const logError = QUIET ? () => {} : console.error.bind(console);

export const apiRoutes = new Hono();

apiRoutes.get("/config", (c) => {
  return c.json({ launchCwd: LAUNCH_CWD, dataDir: getDataDir() });
});

// Get auto-resume configuration and status
apiRoutes.get("/auto-resume/config", (c) => {
  const { getAutoResumeConfig, getSessionsToResume } = require("../services/autoResume");
  const config = getAutoResumeConfig();
  const sessionsToResume = getSessionsToResume();

  return c.json({
    config,
    sessionsToResumeCount: sessionsToResume.length,
    sessions: sessionsToResume.map((s: any) => ({
      sessionId: s.sessionId,
      nodeId: s.nodeId,
      agentName: s.agentName,
      canvasId: s.canvasId,
    })),
  });
});

// Browse directories for file picker
apiRoutes.get("/browse", async (c) => {
  const { readdirSync, statSync } = await import("fs");
  const { join, resolve } = await import("path");
  const { homedir } = await import("os");

  let path = c.req.query("path") || LAUNCH_CWD;

  // Handle ~ for home directory
  if (path.startsWith("~")) {
    path = path.replace("~", homedir());
  }

  // Resolve to absolute path
  path = resolve(path);

  try {
    const entries = readdirSync(path, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({
        name: entry.name,
        path: join(path, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Get parent directory
    const parentPath = resolve(path, "..");

    return c.json({
      current: path,
      parent: parentPath !== path ? parentPath : null,
      directories,
    });
  } catch (e: any) {
    return c.json({ error: e.message, current: path }, 400);
  }
});

apiRoutes.get("/agents", (c) => {
  const agents: Agent[] = [
    {
      id: "claude",
      name: "Claude Code",
      command: "llm agent claude",
      description: "Anthropic's official CLI for Claude",
      color: "#F97316",
      icon: "sparkles",
    },
    {
      id: "opencode",
      name: "OpenCode",
      command: "opencode",
      description: "Open source AI coding assistant",
      color: "#22C55E",
      icon: "code",
    },
    {
      id: "ralph",
      name: "Ralph",
      command: "",
      description: "Autonomous dev loop (ralph, ralph-setup, ralph-import)",
      color: "#8B5CF6",
      icon: "brain",
    },
  ];
  return c.json(agents);
});

apiRoutes.get("/sessions", (c) => {
  const showArchived = c.req.query("archived") === "true";

  // For archived sessions, load from state.json since they're not in sessions Map
  if (showArchived) {
    const state = loadState();
    const archivedSessions = state.nodes
      .filter(node => node.archived)
      .map(node => ({
        sessionId: node.sessionId,
        nodeId: node.nodeId,
        agentId: node.agentId,
        agentName: node.agentName,
        command: node.command,
        createdAt: node.createdAt,
        cwd: node.cwd,
        originalCwd: undefined,
        gitBranch: undefined,
        status: "disconnected",
        customName: node.customName,
        customColor: node.customColor,
        notes: node.notes,
        isRestored: false,
        ticketId: node.ticketId,
        ticketTitle: node.ticketUrl,
        canvasId: node.canvasId,
      }));
    return c.json(archivedSessions);
  }

  // For active sessions, get from sessions Map
  const sessionList = Array.from(sessions.entries())
    .filter(([, session]) => !session.archived)
    .map(([id, session]) => {
      return {
        sessionId: id,
        nodeId: session.nodeId,
        agentId: session.agentId,
        agentName: session.agentName,
        command: session.command,
        createdAt: session.createdAt,
        cwd: session.cwd,
        originalCwd: session.originalCwd, // Mother repo path when using worktrees
        gitBranch: session.gitBranch,
        status: session.status,
        customName: session.customName,
        customColor: session.customColor,
        notes: session.notes,
        isRestored: session.isRestored,
        ticketId: session.ticketId,
        ticketTitle: session.ticketTitle,
        canvasId: session.canvasId, // Canvas/tab this agent belongs to
      };
    });
  return c.json(sessionList);
});

apiRoutes.get("/sessions/:sessionId/status", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = sessions.get(sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);

  return c.json({ status: session.status, isRestored: session.isRestored });
});

apiRoutes.get("/state", (c) => {
  const state = loadState();
  const showArchived = c.req.query("archived") === "true";

  const nodes = state.nodes
    .filter(node => showArchived ? node.archived : !node.archived)
    .map(node => {
      const session = sessions.get(node.sessionId);
      return {
        ...node,
        status: session?.status || "disconnected",
        isAlive: !!session,
        isRestored: session?.isRestored,
      };
    })
    // For archived view, show all archived sessions even if not alive
    // For active view, only show sessions that are currently running
    .filter(n => showArchived || n.isAlive);

  return c.json({ nodes });
});

apiRoutes.post("/state/positions", async (c) => {
  const { positions } = await c.req.json();

  // Also update session positions and canvasId in memory
  for (const [nodeId, pos] of Object.entries(positions)) {
    for (const [, session] of sessions) {
      if (session.nodeId === nodeId) {
        const posData = pos as { x: number; y: number; canvasId?: string };
        session.position = { x: posData.x, y: posData.y };
        session.canvasId = posData.canvasId || session.canvasId;
        break;
      }
    }
  }

  // Save to disk
  savePositions(positions);
  return c.json({ success: true });
});

apiRoutes.post("/sessions", async (c) => {
  const body = await c.req.json();
  const {
    agentId,
    agentName,
    command,
    cwd,
    nodeId,
    customName,
    customColor,
    // Ticket and worktree options
    ticketId,
    ticketTitle,
    ticketUrl,
    branchName,
    baseBranch,
    createWorktree: createWorktreeFlag,
  } = body;

  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const workingDir = cwd || LAUNCH_CWD;

  try {
    const result = createSession({
      sessionId,
      agentId,
      agentName,
      command,
      cwd: workingDir,
      nodeId,
      customName,
      customColor,
      ticketId,
      ticketTitle,
      ticketUrl,
      branchName,
      baseBranch,
      createWorktreeFlag,
      ticketPromptTemplate: undefined,
    });

    saveState(sessions);
    return c.json({
      sessionId,
      nodeId,
      cwd: result.cwd,
      gitBranch: result.gitBranch,
    });
  } catch (error) {
    console.error("[session creation error]", error);
    return c.json({ error: String(error) }, 500);
  }
});

apiRoutes.post("/sessions/:sessionId/restart", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = sessions.get(sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.pty) return c.json({ error: "Session already running" }, 400);

  const startFn = async () => {
    const { spawn } = await import("bun-pty");
    const ptyProcess = spawn("/bin/bash", [], {
      name: "xterm-256color",
      cwd: session.cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        OPENUI_SESSION_ID: sessionId,  // Pass session ID for plugin hooks
      },
      rows: 30,
      cols: 120,
    });

    session.pty = ptyProcess;
    session.isRestored = false;
    session.status = "running";
    session.lastOutputTime = Date.now();

    const resetInterval = setInterval(() => {
      if (!sessions.has(sessionId) || !session.pty) {
        clearInterval(resetInterval);
        return;
      }
      session.recentOutputSize = Math.max(0, session.recentOutputSize - 50);
    }, 500);

    ptyProcess.onData((data: string) => {
      session.outputBuffer.push(data);
      if (session.outputBuffer.length > 1000) {
        session.outputBuffer.shift();
      }

      session.lastOutputTime = Date.now();
      session.recentOutputSize += data.length;

      for (const client of session.clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "output", data }));
        }
      }
    });

    // Build the command with resume flag if we have a Claude session ID
    let finalCommand = injectPluginDir(session.command, session.agentId);

    // For Claude sessions with a known claudeSessionId, use --resume to restore the specific session
    if (session.agentId === "claude" && session.claudeSessionId) {
      // Remove any existing --resume flags first
      finalCommand = finalCommand.replace(/--resume\s+[\w-]+/g, '').replace(/--resume(?=\s|$)/g, '').trim();

      const resumeArg = `--resume ${session.claudeSessionId}`;
      if (finalCommand.includes("llm agent claude")) {
        finalCommand = finalCommand.replace("llm agent claude", `llm agent claude ${resumeArg}`);
      } else if (finalCommand.startsWith("claude")) {
        finalCommand = finalCommand.replace(/^claude(\s|$)/, `claude ${resumeArg}$1`);
      }
      log(`\x1b[38;5;141m[session]\x1b[0m Resuming Claude session: ${session.claudeSessionId}`);
    }

    setTimeout(() => {
      ptyProcess.write(`${finalCommand}\r`);
    }, 300);

    log(`\x1b[38;5;141m[session]\x1b[0m Restarted ${sessionId}`);
  };

  // Claude agents go through the queue to prevent OAuth port contention
  if (session.agentId === "claude") {
    enqueueSessionStart(sessionId, startFn);
  } else {
    startFn();
  }

  return c.json({ success: true });
});

apiRoutes.patch("/sessions/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = sessions.get(sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);

  const updates = await c.req.json();
  if (updates.customName !== undefined) session.customName = updates.customName;
  if (updates.customColor !== undefined) session.customColor = updates.customColor;
  if (updates.notes !== undefined) session.notes = updates.notes;

  saveState(sessions);
  return c.json({ success: true });
});

apiRoutes.delete("/sessions/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  const success = deleteSession(sessionId);

  if (success) {
    saveState(sessions);
    return c.json({ success: true });
  }
  return c.json({ error: "Session not found" }, 404);
});

// Archive/unarchive session
apiRoutes.patch("/sessions/:sessionId/archive", async (c) => {
  const sessionId = c.req.param("sessionId");
  const { archived } = await c.req.json();

  const session = sessions.get(sessionId);

  if (session) {
    // Session is active (in sessions Map) - update it directly
    console.log(`[archive] Updating active session ${sessionId} archived=${archived}`);
    session.archived = archived;
    saveState(sessions);
  } else {
    // Session is not active (archived) - update state.json directly
    console.log(`[archive] Session ${sessionId} not in Map, updating state.json directly`);
    const state = loadState();
    const node = state.nodes?.find(n => n.sessionId === sessionId);
    if (!node) {
      console.log(`[archive] ERROR: Session ${sessionId} not found in state.json`);
      return c.json({ error: "Session not found" }, 404);
    }

    console.log(`[archive] Found node, updating archived from ${node.archived} to ${archived}`);
    // Update archived status
    node.archived = archived;

    // Write state back (this will be preserved by saveState)
    const { writeFileSync } = require("fs");
    const { join } = require("path");
    const { homedir } = require("os");
    const stateFile = join(homedir(), ".openui", "state.json");
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(`[archive] Wrote updated state to ${stateFile}`);
  }

  return c.json({ success: true });
});

// Status update endpoint for Claude Code plugin
apiRoutes.post("/status-update", async (c) => {
  const body = await c.req.json();
  const { status, openuiSessionId, claudeSessionId, cwd, hookEvent, toolName, stopReason } = body;

  // Log the full raw payload for debugging
  log(`\x1b[38;5;82m[plugin-hook]\x1b[0m ${hookEvent || 'unknown'}: status=${status} tool=${toolName || 'none'} openui=${openuiSessionId || 'none'}`);
  log(`\x1b[38;5;245m[plugin-raw]\x1b[0m ${JSON.stringify(body, null, 2)}`);

  if (!status) {
    return c.json({ error: "status is required" }, 400);
  }

  let session = null;

  // Primary: Use OpenUI session ID if provided (this is definitive)
  if (openuiSessionId) {
    session = sessions.get(openuiSessionId);
  }

  // Fallback: Try to match by Claude session ID (for older plugin versions)
  if (!session && claudeSessionId) {
    for (const [id, s] of sessions) {
      if (s.claudeSessionId === claudeSessionId) {
        session = s;
        break;
      }
    }
  }

  if (session) {
    // Store Claude session ID mapping if we have it
    if (claudeSessionId && !session.claudeSessionId) {
      session.claudeSessionId = claudeSessionId;
    }

    // Signal the start queue that this session has completed OAuth/initialization
    if (hookEvent === "SessionStart" && openuiSessionId) {
      signalSessionReady(openuiSessionId);
    }

    // Handle pre_tool/post_tool for permission detection
    let effectiveStatus = status;

    if (status === "pre_tool") {
      // PreToolUse fired - tool is about to run (or waiting for permission)
      // Stay as running, track the tool
      effectiveStatus = "running";
      session.currentTool = toolName;
      session.preToolTime = Date.now();

      // Clear any existing permission timeout
      if (session.permissionTimeout) {
        clearTimeout(session.permissionTimeout);
      }

      // Tool-specific timeout: Bash commands can run for a long time,
      // so don't use timeout-based permission detection for them.
      // For other tools, if post_tool doesn't arrive within 2.5s, assume waiting for permission.
      const longRunningTools = ["Bash", "Task"];
      if (!longRunningTools.includes(toolName)) {
        session.permissionTimeout = setTimeout(() => {
          // Only switch to waiting_input if we haven't received post_tool yet
          if (session.preToolTime) {
            session.status = "waiting_input";
            // Broadcast the status change
            for (const client of session.clients) {
              if (client.readyState === 1) {
                client.send(JSON.stringify({
                  type: "status",
                  status: "waiting_input",
                  isRestored: session.isRestored,
                  currentTool: session.currentTool,
                  hookEvent: "permission_timeout",
                }));
              }
            }
          }
        }, 2500);
      } else {
        session.permissionTimeout = undefined;
      }
    } else if (status === "post_tool") {
      // PostToolUse fired - tool completed, clear the permission timeout
      effectiveStatus = "running";
      session.preToolTime = undefined;
      if (session.permissionTimeout) {
        clearTimeout(session.permissionTimeout);
        session.permissionTimeout = undefined;
      }
      // Keep currentTool to show what just ran
    } else {
      // For other statuses, clear tool tracking if not actively using tools
      if (status !== "tool_calling" && status !== "running") {
        session.currentTool = undefined;
      }
      session.preToolTime = undefined;
      if (session.permissionTimeout) {
        clearTimeout(session.permissionTimeout);
        session.permissionTimeout = undefined;
      }
    }

    session.status = effectiveStatus;
    session.pluginReportedStatus = true;
    session.lastPluginStatusTime = Date.now();
    session.lastHookEvent = hookEvent;

    // Broadcast status change to connected clients
    for (const client of session.clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: "status",
          status: session.status,
          isRestored: session.isRestored,
          currentTool: session.currentTool,
          hookEvent: hookEvent,
        }));
      }
    }

    return c.json({ success: true });
  }

  // No session found
  log(`\x1b[38;5;141m[plugin]\x1b[0m Status update (no session): ${status} for openui:${openuiSessionId} claude:${claudeSessionId}`);
  return c.json({ success: true, warning: "No matching session found" });
});

// ============ Canvas (Tab) Management ============

// Get all canvases
apiRoutes.get("/canvases", (c) => {
  const state = loadState();
  return c.json(state.canvases || []);
});

// Create new canvas
apiRoutes.post("/canvases", async (c) => {
  const canvas = await c.req.json();
  const state = loadState();

  if (!state.canvases) state.canvases = [];
  state.canvases.push(canvas);

  saveCanvases(state.canvases);
  return c.json({ success: true, canvas });
});

// Update canvas
apiRoutes.patch("/canvases/:canvasId", async (c) => {
  const canvasId = c.req.param("canvasId");
  const updates = await c.req.json();
  const state = loadState();

  const canvas = state.canvases?.find(c => c.id === canvasId);
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  Object.assign(canvas, updates);
  saveCanvases(state.canvases!);

  return c.json({ success: true });
});

// Delete canvas (only if empty)
apiRoutes.delete("/canvases/:canvasId", async (c) => {
  const canvasId = c.req.param("canvasId");
  const state = loadState();

  // Check if canvas has nodes
  const hasNodes = state.nodes.some(n => n.canvasId === canvasId);
  if (hasNodes) {
    return c.json({
      error: "Cannot delete canvas with agents. Move agents first."
    }, 400);
  }

  const index = state.canvases?.findIndex(c => c.id === canvasId);
  if (index === undefined || index === -1) {
    return c.json({ error: "Canvas not found" }, 404);
  }

  state.canvases!.splice(index, 1);
  saveCanvases(state.canvases!);

  return c.json({ success: true });
});

// Reorder canvases
apiRoutes.post("/canvases/reorder", async (c) => {
  const { canvasIds } = await c.req.json();
  const state = loadState();

  if (!state.canvases) return c.json({ error: "No canvases" }, 400);

  const reordered = canvasIds.map((id: string, index: number) => {
    const canvas = state.canvases!.find(c => c.id === id);
    if (canvas) canvas.order = index;
    return canvas;
  }).filter(Boolean);

  state.canvases = reordered;
  saveCanvases(state.canvases);

  return c.json({ success: true });
});

// Migration trigger endpoint
apiRoutes.post("/migrate/canvases", (c) => {
  const result = migrateCategoriesToCanvases();
  return c.json(result);
});

// ============ GitHub Integration ============
import {
  fetchGitHubIssues,
  fetchGitHubIssue,
  searchGitHubIssues,
  parseGitHubUrl,
} from "../services/github";

// Get issues from a GitHub repo (no auth needed for public repos)
apiRoutes.get("/github/issues", async (c) => {
  const owner = c.req.query("owner");
  const repo = c.req.query("repo");
  const repoUrl = c.req.query("repoUrl");

  let resolvedOwner = owner;
  let resolvedRepo = repo;

  // If repoUrl provided, parse it
  if (repoUrl && !owner && !repo) {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return c.json({ error: "Invalid GitHub URL" }, 400);
    }
    resolvedOwner = parsed.owner;
    resolvedRepo = parsed.repo;
  }

  if (!resolvedOwner || !resolvedRepo) {
    return c.json({ error: "owner and repo are required (or provide repoUrl)" }, 400);
  }

  try {
    const issues = await fetchGitHubIssues(resolvedOwner, resolvedRepo);
    return c.json(issues);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Search GitHub issues
apiRoutes.get("/github/search", async (c) => {
  const owner = c.req.query("owner");
  const repo = c.req.query("repo");
  const q = c.req.query("q");

  if (!owner || !repo) {
    return c.json({ error: "owner and repo are required" }, 400);
  }
  if (!q) {
    return c.json({ error: "Search query (q) is required" }, 400);
  }

  try {
    const issues = await searchGitHubIssues(owner, repo, q);
    return c.json(issues);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Get single GitHub issue
apiRoutes.get("/github/issue/:owner/:repo/:number", async (c) => {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  const number = parseInt(c.req.param("number"), 10);

  if (isNaN(number)) {
    return c.json({ error: "Invalid issue number" }, 400);
  }

  try {
    const issue = await fetchGitHubIssue(owner, repo, number);
    if (!issue) return c.json({ error: "Issue not found" }, 404);
    return c.json(issue);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

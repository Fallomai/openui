import { Hono } from "hono";
import type { Agent } from "../types";
import { sessions, createSession, deleteSession, scanBufferForMetrics } from "../services/sessionManager";
import { loadState, saveState, savePositions, getDataDir } from "../services/persistence";
import { detectStatus } from "../services/statusDetector";
import {
  loadConfig,
  saveConfig,
  fetchTeams,
  fetchMyTickets,
  searchTickets,
  fetchTicketByIdentifier,
  validateApiKey,
  getCurrentUser,
} from "../services/linear";

const LAUNCH_CWD = process.env.LAUNCH_CWD || process.cwd();

export const apiRoutes = new Hono();

apiRoutes.get("/config", (c) => {
  return c.json({ launchCwd: LAUNCH_CWD, dataDir: getDataDir() });
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

// Statusline setup prompt for Claude Code metrics integration
const STATUSLINE_PROMPT = `/statusline Create a custom status line that outputs metrics for OpenUI integration. It should show model name, directory, lines changed, context %, and cost. At the end include: [OPENUI:{"m":"MODEL","c":COST,"la":LINES_ADDED,"lr":LINES_REMOVED,"cp":CONTEXT_PERCENT,"it":INPUT_TOKENS,"ot":OUTPUT_TOKENS,"s":"STATE"}] where STATE is "idle", "asking", or "working" based on the current claude state. Use jq to parse the JSON input. Make the script and save it.`;

apiRoutes.get("/statusline-prompt", (c) => {
  return c.json({ prompt: STATUSLINE_PROMPT });
});

apiRoutes.get("/agents", (c) => {
  const agents: Agent[] = [
    {
      id: "claude",
      name: "Claude Code",
      command: "claude",
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
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => {
    session.status = detectStatus(session);
    // Scan buffer for latest metrics if not already set
    if (session.agentId === "claude") {
      const scannedMetrics = scanBufferForMetrics(session);
      if (scannedMetrics) {
        console.log(`\x1b[38;5;141m[api]\x1b[0m Scanned metrics for ${id}:`, JSON.stringify(scannedMetrics));
        session.metrics = scannedMetrics;
      }
    }
    return {
      sessionId: id,
      nodeId: session.nodeId,
      agentId: session.agentId,
      agentName: session.agentName,
      command: session.command,
      createdAt: session.createdAt,
      cwd: session.cwd,
      gitBranch: session.gitBranch,
      status: session.status,
      customName: session.customName,
      customColor: session.customColor,
      notes: session.notes,
      isRestored: session.isRestored,
      metrics: session.metrics,
      // Ticket info
      ticketId: session.ticketId,
      ticketTitle: session.ticketTitle,
    };
  });
  return c.json(sessionList);
});

apiRoutes.get("/sessions/:sessionId/status", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = sessions.get(sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);

  session.status = detectStatus(session);
  return c.json({ status: session.status, isRestored: session.isRestored });
});

apiRoutes.get("/state", (c) => {
  const state = loadState();
  const nodes = state.nodes.map(node => {
    const session = sessions.get(node.sessionId);
    return {
      ...node,
      status: session ? detectStatus(session) : "disconnected",
      isAlive: !!session,
      isRestored: session?.isRestored,
    };
  }).filter(n => n.isAlive);
  return c.json({ nodes });
});

apiRoutes.post("/state/positions", async (c) => {
  const { positions } = await c.req.json();

  // Also update session positions in memory
  for (const [nodeId, pos] of Object.entries(positions)) {
    for (const [, session] of sessions) {
      if (session.nodeId === nodeId) {
        session.position = pos as { x: number; y: number };
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

  // Load ticket prompt template from Linear config
  const linearConfig = loadConfig();
  const ticketPromptTemplate = linearConfig.ticketPromptTemplate;

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
    ticketPromptTemplate,
  });

  saveState(sessions);
  return c.json({
    sessionId,
    nodeId,
    cwd: result.cwd,
    gitBranch: result.gitBranch,
  });
});

apiRoutes.post("/sessions/:sessionId/restart", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = sessions.get(sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.pty) return c.json({ error: "Session already running" }, 400);

  const { spawn } = await import("bun-pty");
  const ptyProcess = spawn("/bin/bash", [], {
    name: "xterm-256color",
    cwd: session.cwd,
    env: { ...process.env, TERM: "xterm-256color" },
    rows: 30,
    cols: 120,
  });

  session.pty = ptyProcess;
  session.isRestored = false;
  session.status = "starting";
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

  setTimeout(() => {
    ptyProcess.write(`${session.command}\r`);
  }, 300);

  console.log(`\x1b[38;5;141m[session]\x1b[0m Restarted ${sessionId}`);
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

// Categories (groups)
apiRoutes.get("/categories", (c) => {
  const state = loadState();
  return c.json(state.categories || []);
});

apiRoutes.post("/categories", async (c) => {
  const state = loadState();
  const category = await c.req.json();

  if (!state.categories) state.categories = [];
  state.categories.push(category);

  const { writeFileSync } = require("fs");
  const { join } = require("path");
  const DATA_DIR = join(process.env.LAUNCH_CWD || process.cwd(), ".openui");
  writeFileSync(join(DATA_DIR, "state.json"), JSON.stringify(state, null, 2));

  return c.json({ success: true });
});

apiRoutes.patch("/categories/:categoryId", async (c) => {
  const categoryId = c.req.param("categoryId");
  const updates = await c.req.json();
  const state = loadState();

  if (!state.categories) return c.json({ error: "Category not found" }, 404);

  const category = state.categories.find(cat => cat.id === categoryId);
  if (!category) return c.json({ error: "Category not found" }, 404);

  Object.assign(category, updates);

  const { writeFileSync } = require("fs");
  const { join } = require("path");
  const DATA_DIR = join(process.env.LAUNCH_CWD || process.cwd(), ".openui");
  writeFileSync(join(DATA_DIR, "state.json"), JSON.stringify(state, null, 2));

  return c.json({ success: true });
});

apiRoutes.delete("/categories/:categoryId", (c) => {
  const categoryId = c.req.param("categoryId");
  const state = loadState();

  if (!state.categories) return c.json({ error: "Category not found" }, 404);

  const index = state.categories.findIndex(cat => cat.id === categoryId);
  if (index === -1) return c.json({ error: "Category not found" }, 404);

  state.categories.splice(index, 1);

  const { writeFileSync } = require("fs");
  const { join } = require("path");
  const DATA_DIR = join(process.env.LAUNCH_CWD || process.cwd(), ".openui");
  writeFileSync(join(DATA_DIR, "state.json"), JSON.stringify(state, null, 2));

  return c.json({ success: true });
});

// ============ Linear Integration ============

// Default ticket prompt template
const DEFAULT_TICKET_PROMPT = "Here is the ticket for this session: {{url}}\n\nPlease use the Linear MCP tool or fetch the URL to read the full ticket details before starting work.";

// Get Linear config
apiRoutes.get("/linear/config", (c) => {
  const config = loadConfig();
  // Don't expose full API key, just whether it's set
  return c.json({
    hasApiKey: !!config.apiKey,
    defaultTeamId: config.defaultTeamId,
    defaultBaseBranch: config.defaultBaseBranch || "main",
    createWorktree: config.createWorktree ?? true,
    ticketPromptTemplate: config.ticketPromptTemplate || DEFAULT_TICKET_PROMPT,
  });
});

// Save Linear config
apiRoutes.post("/linear/config", async (c) => {
  const body = await c.req.json();
  const config = loadConfig();

  if (body.apiKey !== undefined) config.apiKey = body.apiKey;
  if (body.defaultTeamId !== undefined) config.defaultTeamId = body.defaultTeamId;
  if (body.defaultBaseBranch !== undefined) config.defaultBaseBranch = body.defaultBaseBranch;
  if (body.createWorktree !== undefined) config.createWorktree = body.createWorktree;
  if (body.ticketPromptTemplate !== undefined) config.ticketPromptTemplate = body.ticketPromptTemplate;

  saveConfig(config);
  return c.json({ success: true });
});

// Validate API key
apiRoutes.post("/linear/validate", async (c) => {
  const { apiKey } = await c.req.json();
  if (!apiKey) return c.json({ valid: false, error: "No API key provided" });

  try {
    const valid = await validateApiKey(apiKey);
    if (valid) {
      const user = await getCurrentUser(apiKey);
      return c.json({ valid: true, user });
    }
    return c.json({ valid: false, error: "Invalid API key" });
  } catch (e: any) {
    return c.json({ valid: false, error: e.message });
  }
});

// Get Linear teams
apiRoutes.get("/linear/teams", async (c) => {
  const config = loadConfig();
  if (!config.apiKey) return c.json({ error: "Linear not configured" }, 400);

  try {
    const teams = await fetchTeams(config.apiKey);
    return c.json(teams);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Get my tickets
apiRoutes.get("/linear/tickets", async (c) => {
  console.log(`\x1b[38;5;141m[api]\x1b[0m GET /linear/tickets called`);
  const config = loadConfig();
  console.log(`\x1b[38;5;141m[api]\x1b[0m Config loaded, hasApiKey:`, !!config.apiKey);

  if (!config.apiKey) {
    console.log(`\x1b[38;5;141m[api]\x1b[0m No API key, returning 400`);
    return c.json({ error: "Linear not configured" }, 400);
  }

  const teamId = c.req.query("teamId") || config.defaultTeamId;
  console.log(`\x1b[38;5;141m[api]\x1b[0m TeamId:`, teamId || "(none)");

  try {
    const tickets = await fetchMyTickets(config.apiKey, teamId);
    console.log(`\x1b[38;5;141m[api]\x1b[0m Returning ${tickets.length} tickets`);
    return c.json(tickets);
  } catch (e: any) {
    console.error(`\x1b[38;5;141m[api]\x1b[0m Error fetching tickets:`, e.message);
    return c.json({ error: e.message }, 500);
  }
});

// Search tickets
apiRoutes.get("/linear/search", async (c) => {
  const config = loadConfig();
  if (!config.apiKey) return c.json({ error: "Linear not configured" }, 400);

  const query = c.req.query("q");
  if (!query) return c.json({ error: "Search query required" }, 400);

  const teamId = c.req.query("teamId") || config.defaultTeamId;

  try {
    const tickets = await searchTickets(config.apiKey, query, teamId);
    return c.json(tickets);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Get ticket by identifier
apiRoutes.get("/linear/ticket/:identifier", async (c) => {
  const config = loadConfig();
  if (!config.apiKey) return c.json({ error: "Linear not configured" }, 400);

  const identifier = c.req.param("identifier");

  try {
    const ticket = await fetchTicketByIdentifier(config.apiKey, identifier);
    if (!ticket) return c.json({ error: "Ticket not found" }, 404);
    return c.json(ticket);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
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

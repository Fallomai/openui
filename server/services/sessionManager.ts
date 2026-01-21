import { spawnSync } from "bun";
import { spawn as spawnPty } from "bun-pty";
import { existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import type { Session, ClaudeMetrics } from "../types";
import { loadBuffer } from "./persistence";
import { detectStatus } from "./statusDetector";

// Get git branch for a directory
function getGitBranch(cwd: string): string | null {
  try {
    const result = spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode === 0) {
      return result.stdout.toString().trim();
    }
  } catch {
    // Not a git repo or git not available
  }
  return null;
}

// Get git root directory
function getGitRoot(cwd: string): string | null {
  try {
    const result = spawnSync(["git", "rev-parse", "--show-toplevel"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode === 0) {
      return result.stdout.toString().trim();
    }
  } catch {
    // Not a git repo
  }
  return null;
}

// Create a git worktree for a branch
export function createWorktree(params: {
  cwd: string;
  branchName: string;
  baseBranch: string;
}): { success: boolean; worktreePath?: string; error?: string } {
  const { cwd, branchName, baseBranch } = params;
  const gitRoot = getGitRoot(cwd);

  if (!gitRoot) {
    return { success: false, error: "Not a git repository" };
  }

  // Create worktrees directory beside the main repo
  const repoName = basename(gitRoot);
  const worktreesDir = join(gitRoot, "..", `${repoName}-worktrees`);

  if (!existsSync(worktreesDir)) {
    mkdirSync(worktreesDir, { recursive: true });
  }

  // Sanitize branch name for directory
  const dirName = branchName.replace(/\//g, "-");
  const worktreePath = join(worktreesDir, dirName);

  // Check if worktree already exists
  if (existsSync(worktreePath)) {
    console.log(`\x1b[38;5;141m[worktree]\x1b[0m Worktree already exists: ${worktreePath}`);
    return { success: true, worktreePath };
  }

  // Fetch latest from remote first
  console.log(`\x1b[38;5;141m[worktree]\x1b[0m Fetching from remote...`);
  spawnSync(["git", "fetch", "origin"], { cwd: gitRoot, stdout: "pipe", stderr: "pipe" });

  // Check if branch exists locally or remotely
  const localBranch = spawnSync(["git", "rev-parse", "--verify", branchName], {
    cwd: gitRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  const remoteBranch = spawnSync(["git", "rev-parse", "--verify", `origin/${branchName}`], {
    cwd: gitRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  let result;
  if (localBranch.exitCode === 0) {
    // Branch exists locally, just add worktree
    console.log(`\x1b[38;5;141m[worktree]\x1b[0m Creating worktree for existing branch: ${branchName}`);
    result = spawnSync(["git", "worktree", "add", worktreePath, branchName], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
  } else if (remoteBranch.exitCode === 0) {
    // Branch exists on remote, track it
    console.log(`\x1b[38;5;141m[worktree]\x1b[0m Creating worktree tracking remote branch: ${branchName}`);
    result = spawnSync(["git", "worktree", "add", "--track", "-b", branchName, worktreePath, `origin/${branchName}`], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
  } else {
    // Create new branch from base
    console.log(`\x1b[38;5;141m[worktree]\x1b[0m Creating new worktree with branch: ${branchName} from ${baseBranch}`);
    result = spawnSync(["git", "worktree", "add", "-b", branchName, worktreePath, `origin/${baseBranch}`], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
  }

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    console.error(`\x1b[38;5;141m[worktree]\x1b[0m Failed to create worktree:`, stderr);
    return { success: false, error: stderr };
  }

  console.log(`\x1b[38;5;141m[worktree]\x1b[0m Created worktree at: ${worktreePath}`);
  return { success: true, worktreePath };
}

// Parse OpenUI metrics from statusline output
// Format: [OPENUI:{"m":"Opus","c":0.01,"la":10,"lr":5,"cp":25,"it":1000,"ot":500,"s":"idle"}]
function parseMetrics(data: string): ClaudeMetrics | null {
  // Strip ANSI codes first
  const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '');

  // Remove newlines/whitespace that might break the JSON
  const normalized = cleanData.replace(/\s+/g, ' ');

  // Find complete JSON objects - match from { to } ensuring we have all keys
  const matches = normalized.match(/\[OPENUI:\{[^}]+\}\]/g);
  if (!matches || matches.length === 0) return null;

  // Try each match from the end (most recent first)
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    // Extract just the JSON part
    const jsonStr = match.slice(8, -1); // Remove "[OPENUI:" and "]"

    try {
      const json = JSON.parse(jsonStr);
      // Validate it has the expected fields
      if (json.m !== undefined || json.c !== undefined) {
        return {
          model: json.m || "Claude",
          cost: typeof json.c === 'number' ? json.c : parseFloat(json.c) || 0,
          linesAdded: json.la || 0,
          linesRemoved: json.lr || 0,
          contextPercent: json.cp || 0,
          inputTokens: json.it || 0,
          outputTokens: json.ot || 0,
          state: json.s || undefined,
        };
      }
    } catch {
      // Try next match
      continue;
    }
  }

  return null;
}

// Scan buffer for metrics (call periodically)
export function scanBufferForMetrics(session: Session): ClaudeMetrics | null {
  if (session.agentId !== "claude") return null;
  const buffer = session.outputBuffer.join("");
  // Only scan the last ~5000 chars for performance
  const recentBuffer = buffer.slice(-5000);
  return parseMetrics(recentBuffer);
}

const MAX_BUFFER_SIZE = 1000;

export const sessions = new Map<string, Session>();

export function createSession(params: {
  sessionId: string;
  agentId: string;
  agentName: string;
  command: string;
  cwd: string;
  nodeId: string;
  customName?: string;
  customColor?: string;
  // Ticket and worktree options
  ticketId?: string;
  ticketTitle?: string;
  ticketUrl?: string;
  branchName?: string;
  baseBranch?: string;
  createWorktreeFlag?: boolean;
  ticketPromptTemplate?: string;
}): { session: Session; cwd: string; gitBranch?: string } {
  const {
    sessionId,
    agentId,
    agentName,
    command,
    cwd: originalCwd,
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
  } = params;

  let workingDir = originalCwd;
  let worktreePath: string | undefined;
  let gitBranch: string | null = null;

  // If worktree requested, create it and use that path
  if (createWorktreeFlag && branchName && baseBranch) {
    const result = createWorktree({
      cwd: originalCwd,
      branchName,
      baseBranch,
    });
    if (result.success && result.worktreePath) {
      workingDir = result.worktreePath;
      worktreePath = result.worktreePath;
      gitBranch = branchName;
      console.log(`\x1b[38;5;141m[session]\x1b[0m Using worktree: ${workingDir}`);
    } else {
      console.error(`\x1b[38;5;141m[session]\x1b[0m Failed to create worktree:`, result.error);
    }
  }

  // Get git branch if not already set from worktree
  if (!gitBranch) {
    gitBranch = getGitBranch(workingDir);
  }

  const ptyProcess = spawnPty("/bin/bash", [], {
    name: "xterm-256color",
    cwd: workingDir,
    env: { ...process.env, TERM: "xterm-256color" },
    rows: 30,
    cols: 120,
  });

  const now = Date.now();
  const session: Session = {
    pty: ptyProcess,
    agentId,
    agentName,
    command,
    cwd: workingDir,
    gitBranch: gitBranch || undefined,
    worktreePath,
    createdAt: new Date().toISOString(),
    clients: new Set(),
    outputBuffer: [],
    status: "starting",
    lastOutputTime: now,
    lastInputTime: 0,
    recentOutputSize: 0,
    customName,
    customColor,
    nodeId,
    isRestored: false,
    ticketId,
    ticketTitle,
    ticketUrl,
  };

  sessions.set(sessionId, session);

  // Output decay
  const resetInterval = setInterval(() => {
    if (!sessions.has(sessionId) || !session.pty) {
      clearInterval(resetInterval);
      return;
    }
    session.recentOutputSize = Math.max(0, session.recentOutputSize - 50);
  }, 500);

  // PTY output handler
  ptyProcess.onData((data: string) => {
    // Debug: log if we see OPENUI in the data
    if (data.includes("OPENUI")) {
      console.log(`\x1b[38;5;141m[pty-data]\x1b[0m Found OPENUI in chunk:`, data.length, "chars");
    }

    session.outputBuffer.push(data);
    if (session.outputBuffer.length > MAX_BUFFER_SIZE) {
      session.outputBuffer.shift();
    }

    session.lastOutputTime = Date.now();
    session.recentOutputSize += data.length;

    // Parse metrics from statusline (for Claude agents)
    if (agentId === "claude") {
      const metrics = parseMetrics(data);
      if (metrics) {
        console.log(`\x1b[38;5;141m[metrics]\x1b[0m Parsed:`, JSON.stringify(metrics));
        session.metrics = metrics;
        // Broadcast metrics update
        for (const client of session.clients) {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ type: "metrics", metrics }));
          }
        }
      }
    }

    const newStatus = detectStatus(session);
    const statusChanged = newStatus !== session.status;
    session.status = newStatus;

    for (const client of session.clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "output", data }));

        if (statusChanged) {
          client.send(JSON.stringify({
            type: "status",
            status: session.status,
            isRestored: session.isRestored
          }));
        }
      }
    }
  });

  // Run the command
  setTimeout(() => {
    ptyProcess.write(`${command}\r`);

    // If there's a ticket URL, send it to the agent after a delay
    if (ticketUrl) {
      setTimeout(() => {
        // Use custom template or default
        const defaultTemplate = "Here is the ticket for this session: {{url}}\n\nPlease use the Linear MCP tool or fetch the URL to read the full ticket details before starting work.";
        const template = ticketPromptTemplate || defaultTemplate;
        const ticketPrompt = template
          .replace(/\{\{url\}\}/g, ticketUrl)
          .replace(/\{\{id\}\}/g, ticketId || "")
          .replace(/\{\{title\}\}/g, ticketTitle || "");
        ptyProcess.write(ticketPrompt + "\r");
      }, 2000);
    }
  }, 300);

  console.log(`\x1b[38;5;141m[session]\x1b[0m Created ${sessionId} for ${agentName}${ticketId ? ` (ticket: ${ticketId})` : ""}`);
  return { session, cwd: workingDir, gitBranch: gitBranch || undefined };
}

export function deleteSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  if (session.pty) session.pty.kill();

  sessions.delete(sessionId);
  console.log(`\x1b[38;5;141m[session]\x1b[0m Killed ${sessionId}`);
  return true;
}

export function restoreSessions() {
  const { loadState } = require("./persistence");
  const state = loadState();

  console.log(`\x1b[38;5;245m[restore]\x1b[0m Found ${state.nodes.length} saved sessions`);

  for (const node of state.nodes) {
    const buffer = loadBuffer(node.sessionId);
    const gitBranch = getGitBranch(node.cwd);

    const session: Session = {
      pty: null,
      agentId: node.agentId,
      agentName: node.agentName,
      command: node.command,
      cwd: node.cwd,
      gitBranch: gitBranch || undefined,
      createdAt: node.createdAt,
      clients: new Set(),
      outputBuffer: buffer,
      status: "disconnected",
      lastOutputTime: 0,
      lastInputTime: 0,
      recentOutputSize: 0,
      customName: node.customName,
      customColor: node.customColor,
      notes: node.notes,
      nodeId: node.nodeId,
      isRestored: true,
    };

    sessions.set(node.sessionId, session);
    console.log(`\x1b[38;5;245m[restore]\x1b[0m Restored ${node.sessionId} (${node.agentName}) branch: ${gitBranch || 'none'}`);
  }
}

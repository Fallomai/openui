import { spawnSync } from "bun";
import { spawn as spawnPty } from "bun-pty";
import { existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import type { Session } from "../types";
import { loadBuffer } from "./persistence";
import { enqueueSessionStart, signalSessionReady } from "./sessionStartQueue";

const QUIET = !!process.env.OPENUI_QUIET;
const log = QUIET ? () => {} : console.log.bind(console);
const logError = QUIET ? () => {} : console.error.bind(console);

// Get the OpenUI plugin directory path
function getPluginDir(): string | null {
  // Check for plugin in ~/.openui/claude-code-plugin (installed via curl)
  const homePluginDir = join(homedir(), ".openui", "claude-code-plugin");
  const homePluginJson = join(homePluginDir, ".claude-plugin", "plugin.json");
  log(`\x1b[38;5;245m[plugin-check]\x1b[0m Checking home: ${homePluginJson} exists=${existsSync(homePluginJson)}`);
  if (existsSync(homePluginJson)) {
    return homePluginDir;
  }

  // Check for plugin in the openui repo (for development)
  // Use import.meta.dir for ESM compatibility
  const currentDir = import.meta.dir || __dirname;
  const repoPluginDir = join(currentDir, "..", "..", "claude-code-plugin");
  const repoPluginJson = join(repoPluginDir, ".claude-plugin", "plugin.json");
  log(`\x1b[38;5;245m[plugin-check]\x1b[0m Checking repo: ${repoPluginJson} exists=${existsSync(repoPluginJson)}`);
  if (existsSync(repoPluginJson)) {
    return repoPluginDir;
  }

  log(`\x1b[38;5;245m[plugin-check]\x1b[0m No plugin found`);
  return null;
}

// Inject --plugin-dir flag for Claude commands if plugin is available
export function injectPluginDir(command: string, agentId: string): string {
  if (agentId !== "claude") return command;

  const pluginDir = getPluginDir();
  if (!pluginDir) return command;

  // Check if command already has --plugin-dir
  if (command.includes("--plugin-dir")) return command;

  // Handle both "claude" and "llm agent claude" command formats
  const parts = command.split(/\s+/);

  // Check for "llm agent claude" format
  if (parts[0] === "llm" && parts[1] === "agent" && parts[2] === "claude") {
    // Insert --plugin-dir after 'claude' (index 2)
    parts.splice(3, 0, `--plugin-dir`, pluginDir);
    const finalCmd = parts.join(" ");
    log(`\x1b[38;5;141m[plugin]\x1b[0m Injecting plugin-dir: ${pluginDir}`);
    log(`\x1b[38;5;141m[plugin]\x1b[0m Final command: ${finalCmd}`);
    return finalCmd;
  }

  // Check for plain "claude" format
  if (parts[0] === "claude") {
    // Use the path directly without quotes - shell will handle it
    parts.splice(1, 0, `--plugin-dir`, pluginDir);
    const finalCmd = parts.join(" ");
    log(`\x1b[38;5;141m[plugin]\x1b[0m Injecting plugin-dir: ${pluginDir}`);
    log(`\x1b[38;5;141m[plugin]\x1b[0m Final command: ${finalCmd}`);
    return finalCmd;
  }

  return command;
}

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

// Get git root directory (returns worktree path if in a worktree)
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

// Get the main worktree (mother repo) path - works from any worktree
function getMainWorktree(cwd: string): string | null {
  try {
    // git worktree list shows all worktrees, first one is always the main
    const result = spawnSync(["git", "worktree", "list", "--porcelain"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode === 0) {
      const output = result.stdout.toString();
      // First "worktree" line is the main repo
      const match = output.match(/^worktree (.+)$/m);
      if (match) {
        return match[1];
      }
    }
  } catch {
    // Not a git repo or worktree command failed
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
    log(`\x1b[38;5;141m[worktree]\x1b[0m Worktree already exists: ${worktreePath}`);
    return { success: true, worktreePath };
  }

  // Fetch latest from remote first
  log(`\x1b[38;5;141m[worktree]\x1b[0m Fetching from remote...`);
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
    log(`\x1b[38;5;141m[worktree]\x1b[0m Creating worktree for existing branch: ${branchName}`);
    result = spawnSync(["git", "worktree", "add", worktreePath, branchName], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
  } else if (remoteBranch.exitCode === 0) {
    // Branch exists on remote, track it
    log(`\x1b[38;5;141m[worktree]\x1b[0m Creating worktree tracking remote branch: ${branchName}`);
    result = spawnSync(["git", "worktree", "add", "--track", "-b", branchName, worktreePath, `origin/${branchName}`], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
  } else {
    // Create new branch from base
    log(`\x1b[38;5;141m[worktree]\x1b[0m Creating new worktree with branch: ${branchName} from ${baseBranch}`);
    result = spawnSync(["git", "worktree", "add", "-b", branchName, worktreePath, `origin/${baseBranch}`], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
  }

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    logError(`\x1b[38;5;141m[worktree]\x1b[0m Failed to create worktree:`, stderr);
    return { success: false, error: stderr };
  }

  log(`\x1b[38;5;141m[worktree]\x1b[0m Created worktree at: ${worktreePath}`);
  return { success: true, worktreePath };
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
  let mainRepoPath: string | undefined;
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
      mainRepoPath = originalCwd; // The original cwd is the main repo
      gitBranch = branchName;
      log(`\x1b[38;5;141m[session]\x1b[0m Using worktree: ${workingDir}, main repo: ${mainRepoPath}`);
    } else {
      logError(`\x1b[38;5;141m[session]\x1b[0m Failed to create worktree:`, result.error);
    }
  }

  // If no explicit worktree but we're in a worktree, detect the main repo
  if (!mainRepoPath) {
    const detectedMainRepo = getMainWorktree(workingDir);
    if (detectedMainRepo && detectedMainRepo !== workingDir) {
      mainRepoPath = detectedMainRepo;
      log(`\x1b[38;5;141m[session]\x1b[0m Detected main repo from worktree: ${mainRepoPath}`);
    }
  }

  // Get git branch if not already set from worktree
  if (!gitBranch) {
    gitBranch = getGitBranch(workingDir);
  }

  const ptyProcess = spawnPty("/bin/bash", [], {
    name: "xterm-256color",
    cwd: workingDir,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      // Pass our session ID so the plugin can include it in status updates
      OPENUI_SESSION_ID: sessionId,
    },
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
    originalCwd: mainRepoPath, // Store mother repo when using worktree
    gitBranch: gitBranch || undefined,
    worktreePath,
    createdAt: new Date().toISOString(),
    clients: new Set(),
    outputBuffer: [],
    status: "idle",
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
    session.outputBuffer.push(data);
    if (session.outputBuffer.length > MAX_BUFFER_SIZE) {
      session.outputBuffer.shift();
    }

    session.lastOutputTime = Date.now();
    session.recentOutputSize += data.length;

    // Just broadcast output - status comes from plugin hooks
    for (const client of session.clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "output", data }));
      }
    }
  });

  // Run the command (inject plugin-dir for Claude if available)
  const finalCommand = injectPluginDir(command, agentId);
  log(`\x1b[38;5;82m[pty-write]\x1b[0m Writing command: ${finalCommand}`);

  const writeCommand = () => {
    setTimeout(() => {
      ptyProcess.write(`${finalCommand}\r`);

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
  };

  // Claude agents go through the queue to prevent OAuth port contention
  if (agentId === "claude") {
    enqueueSessionStart(sessionId, writeCommand);
  } else {
    writeCommand();
  }

  log(`\x1b[38;5;141m[session]\x1b[0m Created ${sessionId} for ${agentName}${ticketId ? ` (ticket: ${ticketId})` : ""}`);
  return { session, cwd: workingDir, gitBranch: gitBranch || undefined };
}

export function deleteSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  if (session.pty) session.pty.kill();

  sessions.delete(sessionId);
  log(`\x1b[38;5;141m[session]\x1b[0m Killed ${sessionId}`);
  return true;
}

export function restoreSessions() {
  const { loadState } = require("./persistence");
  const state = loadState();

  log(`\x1b[38;5;245m[restore]\x1b[0m Found ${state.nodes.length} saved sessions`);

  for (const node of state.nodes) {
    // Skip archived sessions - they should not be in the active sessions Map
    if (node.archived) {
      console.log(`[restore] Skipping archived session: ${node.sessionId} (${node.customName})`);
      continue;
    }
    console.log(`[restore] Loading session: ${node.sessionId} (${node.customName}) archived=${node.archived}`);

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
      autoResumed: node.autoResumed || false,
      claudeSessionId: node.claudeSessionId,  // Restore Claude session ID for --resume
      archived: false,  // Active sessions are never archived
      canvasId: node.canvasId,  // Canvas/tab this agent belongs to
    };

    sessions.set(node.sessionId, session);
    log(`\x1b[38;5;245m[restore]\x1b[0m Restored ${node.sessionId} (${node.agentName}) branch: ${gitBranch || 'none'}`);
  }
}

/**
 * Auto-resume sessions on startup (resumes all non-archived sessions)
 */
export function autoResumeSessions() {
  const { getSessionsToResume, getAutoResumeConfig } = require("./autoResume");
  const { saveState } = require("./persistence");

  const config = getAutoResumeConfig();
  if (!config.enabled) {
    log(`\x1b[38;5;141m[auto-resume]\x1b[0m Auto-resume is disabled`);
    return;
  }

  const sessionsToResume = getSessionsToResume();

  if (sessionsToResume.length === 0) {
    log(`\x1b[38;5;141m[auto-resume]\x1b[0m No sessions to auto-resume`);
    return;
  }

  log(`\x1b[38;5;141m[auto-resume]\x1b[0m Auto-resuming ${sessionsToResume.length} sessions...`);

  for (const node of sessionsToResume) {
    const session = sessions.get(node.sessionId);
    if (!session) {
      log(`\x1b[38;5;245m[auto-resume]\x1b[0m Session not found: ${node.sessionId}`);
      continue;
    }

    // Skip if already has a PTY (already running)
    if (session.pty) {
      log(`\x1b[38;5;245m[auto-resume]\x1b[0m Skipping ${node.sessionId} (already running)`);
      continue;
    }

    const startFn = () => {
      try {
        // Spawn a new PTY for this session
        const ptyProcess = spawnPty("/bin/bash", [], {
          name: "xterm-256color",
          cwd: session.cwd,
          env: {
            ...process.env,
            TERM: "xterm-256color",
            OPENUI_SESSION_ID: node.sessionId,
          },
          rows: 30,
          cols: 120,
        });

        session.pty = ptyProcess;
        session.status = "idle";
        session.isRestored = false;
        session.autoResumed = true;

        // Set up PTY data handler
        ptyProcess.onData((data: string) => {
          session.outputBuffer.push(data);
          if (session.outputBuffer.length > 2000) {
            session.outputBuffer.shift();
          }

          session.lastOutputTime = Date.now();
          session.recentOutputSize += data.length;

          // Broadcast to all connected clients
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
          log(`\x1b[38;5;141m[auto-resume]\x1b[0m Resuming Claude session: ${session.claudeSessionId}`);
        }

        // Send the command to the PTY after a short delay
        setTimeout(() => {
          ptyProcess.write(`${finalCommand}\r`);
        }, 300);

        log(`\x1b[38;5;141m[auto-resume]\x1b[0m Resumed ${node.sessionId} (${node.agentName})`);
      } catch (error) {
        logError(`\x1b[38;5;141m[auto-resume]\x1b[0m Failed to resume ${node.sessionId}:`, error);
        // Signal ready on failure so the queue isn't blocked
        signalSessionReady(node.sessionId);
      }
    };

    // Claude agents go through the queue to prevent OAuth port contention
    if (session.agentId === "claude") {
      enqueueSessionStart(node.sessionId, startFn);
    } else {
      // Non-Claude agents start immediately (no OAuth)
      startFn();
    }
  }

  // Save state to persist autoResumed flag
  saveState(sessions);
  log(`\x1b[38;5;141m[auto-resume]\x1b[0m Auto-resume complete`);
}

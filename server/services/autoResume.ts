import { loadState } from "./persistence";
import type { PersistedNode } from "../types";

export interface AutoResumeConfig {
  enabled: boolean;
  skipArchived: boolean;
  maxConcurrent?: number; // Optional limit on concurrent resumes
  startupTimeoutMs?: number; // Max wait per agent during sequential startup (default 30s)
  postSignalDelayMs?: number; // Delay after SessionStart signal before starting next agent (default 2s)
}

const DEFAULT_CONFIG: AutoResumeConfig = {
  enabled: true,
  skipArchived: true, // Skip archived sessions as per user requirement
  maxConcurrent: undefined, // No limit by default
  startupTimeoutMs: Number(process.env.OPENUI_STARTUP_TIMEOUT_MS) || 30000,
  postSignalDelayMs: Number(process.env.OPENUI_POST_SIGNAL_DELAY_MS) || 2000,
};

/**
 * Get auto-resume configuration
 */
export function getAutoResumeConfig(): AutoResumeConfig {
  // Could be extended to read from config file or environment variables
  return DEFAULT_CONFIG;
}

/**
 * Get list of sessions that should be auto-resumed on startup
 */
export function getSessionsToResume(): PersistedNode[] {
  const config = getAutoResumeConfig();

  if (!config.enabled) {
    return [];
  }

  const state = loadState();
  let sessionsToResume = state.nodes || [];

  // Filter out archived sessions if configured
  if (config.skipArchived) {
    sessionsToResume = sessionsToResume.filter(s => !s.archived);
  }

  // Apply concurrent limit if configured
  if (config.maxConcurrent !== undefined && config.maxConcurrent > 0) {
    // Sort by most recently created and take only maxConcurrent
    sessionsToResume = sessionsToResume
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, config.maxConcurrent);
  }

  return sessionsToResume;
}

/**
 * Check if a specific session should be auto-resumed
 */
export function shouldAutoResume(session: PersistedNode): boolean {
  const config = getAutoResumeConfig();

  if (!config.enabled) {
    return false;
  }

  // Skip archived sessions
  if (config.skipArchived && session.archived) {
    return false;
  }

  return true;
}

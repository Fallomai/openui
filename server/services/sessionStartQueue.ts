/**
 * Session Start Queue
 *
 * Serializes Claude agent starts to prevent OAuth port contention.
 * When multiple Claude instances start simultaneously, they all try to bind
 * port 8020 for OAuth callback. This queue ensures only one starts at a time,
 * using the SessionStart plugin hook as the "ready" signal.
 */

import { getAutoResumeConfig } from "./autoResume";

const QUIET = !!process.env.OPENUI_QUIET;
const log = QUIET ? () => {} : console.log.bind(console);

interface PendingStart {
  sessionId: string;
  resolve: () => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface QueueEntry {
  sessionId: string;
  startFn: () => void;
}

let currentPending: PendingStart | null = null;
const queue: QueueEntry[] = [];
let processing = false;

/**
 * Enqueue a Claude agent start. The startFn will be called when it's
 * this session's turn. The queue advances when signalSessionReady()
 * is called or the timeout expires.
 */
export function enqueueSessionStart(sessionId: string, startFn: () => void): void {
  queue.push({ sessionId, startFn });
  if (!processing) {
    processQueue();
  }
}

/**
 * Signal that a session has finished its startup (OAuth complete).
 * Called from the /api/status-update handler on SessionStart hook events.
 */
export function signalSessionReady(sessionId: string): void {
  if (!currentPending || currentPending.sessionId !== sessionId) return;

  clearTimeout(currentPending.timeoutHandle);
  log(`\x1b[38;5;82m[start-queue]\x1b[0m Session ${sessionId} signaled ready`);

  const config = getAutoResumeConfig();
  const delay = config.postSignalDelayMs ?? 2000;

  // Wait a short delay after signal for port 8020 to fully release
  const pending = currentPending;
  currentPending = null;
  setTimeout(() => {
    pending.resolve();
  }, delay);
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const next = queue.shift()!;
    log(`\x1b[38;5;141m[start-queue]\x1b[0m Starting ${next.sessionId} (${queue.length} remaining in queue)`);

    await new Promise<void>((resolve) => {
      const config = getAutoResumeConfig();
      const timeout = config.startupTimeoutMs ?? 30000;

      const timeoutHandle = setTimeout(() => {
        log(`\x1b[38;5;208m[start-queue]\x1b[0m Timeout waiting for ${next.sessionId} (${timeout}ms), proceeding`);
        currentPending = null;
        resolve();
      }, timeout);

      currentPending = {
        sessionId: next.sessionId,
        resolve,
        timeoutHandle,
      };

      // Actually start the session
      next.startFn();
    });
  }

  processing = false;
}

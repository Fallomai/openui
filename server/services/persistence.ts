import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PersistedState, Session } from "../types";
import type { Canvas } from "../types/canvas";

// Use global ~/.openui folder for centralized state
const DATA_DIR = join(homedir(), ".openui");
const STATE_FILE = join(DATA_DIR, "state.json");
const BUFFERS_DIR = join(DATA_DIR, "buffers");

// Keep for migration from old location
const LAUNCH_CWD = process.env.LAUNCH_CWD || process.cwd();
const OLD_DATA_DIR = join(LAUNCH_CWD, ".openui");

// Ensure directories exist
function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(BUFFERS_DIR)) mkdirSync(BUFFERS_DIR, { recursive: true });
}

// Migrate existing data from LAUNCH_CWD to home directory
export function migrateStateToHome(): { migrated: boolean; source?: string } {
  const oldStateFile = join(OLD_DATA_DIR, "state.json");
  const oldBuffersDir = join(OLD_DATA_DIR, "buffers");

  // Skip if no old state exists
  if (!existsSync(oldStateFile)) {
    return { migrated: false };
  }

  // Check if new state exists and has data
  if (existsSync(STATE_FILE)) {
    try {
      const existingState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      // Only skip if new state has actual nodes (not empty)
      if (existingState.nodes && existingState.nodes.length > 0) {
        console.log(`[persistence] State already exists at ${STATE_FILE} with data, skipping migration`);
        return { migrated: false };
      }
      // If state exists but is empty, proceed with migration
      console.log(`[persistence] Found empty state at ${STATE_FILE}, proceeding with migration`);
    } catch (e) {
      console.log(`[persistence] Could not read existing state, proceeding with migration`);
    }
  }

  console.log(`[persistence] Migrating state from ${OLD_DATA_DIR} to ${DATA_DIR}`);

  try {
    ensureDirs();

    // Copy state.json
    const oldState = readFileSync(oldStateFile, "utf-8");
    writeFileSync(STATE_FILE, oldState);

    // Copy buffers directory
    if (existsSync(oldBuffersDir)) {
      const bufferFiles = readdirSync(oldBuffersDir);
      for (const file of bufferFiles) {
        copyFileSync(join(oldBuffersDir, file), join(BUFFERS_DIR, file));
      }
    }

    console.log(`[persistence] Migration complete`);
    return { migrated: true, source: OLD_DATA_DIR };
  } catch (e) {
    console.error("[persistence] Migration failed:", e);
    return { migrated: false };
  }
}

// Migrate folder/category system to canvas/tab system
export function migrateCategoriesToCanvases(): { migrated: boolean; canvasCount: number } {
  const state = loadState();

  // Skip if already migrated (canvases exist)
  if (state.canvases && state.canvases.length > 0) {
    return { migrated: false, canvasCount: state.canvases.length };
  }

  const canvases: Canvas[] = [];
  const nodeUpdates: Map<string, string> = new Map();

  // Create default "Main" canvas
  const defaultCanvasId = `canvas-default-${Date.now()}`;
  canvases.push({
    id: defaultCanvasId,
    name: "Main",
    color: "#3B82F6",
    order: 0,
    createdAt: new Date().toISOString(),
    isDefault: true,
  });

  // Create canvases from existing categories (folders)
  if (state.categories && state.categories.length > 0) {
    state.categories.forEach((cat, index) => {
      const canvasId = `canvas-${Date.now()}-${index}`;
      canvases.push({
        id: canvasId,
        name: cat.label,
        color: cat.color,
        order: index + 1,
        createdAt: new Date().toISOString(),
      });

      // Map nodes with this parentId to new canvas
      state.nodes.forEach(node => {
        if ((node as any).parentId === cat.id) {
          nodeUpdates.set(node.nodeId, canvasId);
        }
      });
    });
  }

  // Update all nodes
  state.nodes.forEach(node => {
    const existingCanvasId = (node as any).canvasId;
    // Update if node has parentId, no canvasId, or has old "canvas-default" fallback
    if ((node as any).parentId || !existingCanvasId || existingCanvasId === "canvas-default") {
      (node as any).canvasId = nodeUpdates.get(node.nodeId) || defaultCanvasId;
    }
    delete (node as any).parentId; // Remove old field
  });

  state.canvases = canvases;

  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`[migration] Migrated ${state.categories?.length || 0} categories to ${canvases.length} canvases`);
  } catch (e) {
    console.error("[migration] Failed to migrate canvases:", e);
  }

  return { migrated: true, canvasCount: canvases.length };
}

export function loadCanvases(): Canvas[] {
  const state = loadState();
  return state.canvases || [];
}

export function saveCanvases(canvases: Canvas[]) {
  ensureDirs();
  const state = loadState();
  state.canvases = canvases;
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("Failed to save canvases:", e);
  }
}

export function loadState(): PersistedState {
  ensureDirs();
  try {
    if (existsSync(STATE_FILE)) {
      const data = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      console.log(`\x1b[38;5;245m[persistence]\x1b[0m Loaded state from ${STATE_FILE}`);
      return data;
    }
  } catch (e) {
    console.error("Failed to load state:", e);
  }
  return { nodes: [] };
}

export function saveState(sessions: Map<string, Session>) {
  ensureDirs();
  const savedState = loadState();

  // Preserve categories and canvases from existing state
  const state: PersistedState = {
    nodes: [],
    canvases: savedState.canvases || [],
    categories: savedState.categories || [],
  };

  // Get default canvas ID for fallback
  const defaultCanvas = state.canvases.find(c => c.isDefault) || state.canvases[0];
  const defaultCanvasId = defaultCanvas?.id || "canvas-default";

  for (const [sessionId, session] of sessions) {
    // Preserve existing position if we have one
    const existingNode = savedState.nodes.find(n => n.sessionId === sessionId);

    // Determine canvasId: use existing node's canvasId if available, otherwise session's canvasId,
    // but replace old "canvas-default" placeholder with actual default canvas ID
    let canvasId = session.canvasId || existingNode?.canvasId || defaultCanvasId;
    if (canvasId === "canvas-default") {
      canvasId = defaultCanvasId;
    }

    state.nodes.push({
      nodeId: session.nodeId,
      sessionId,
      agentId: session.agentId,
      agentName: session.agentName,
      command: session.command,
      cwd: session.cwd,
      createdAt: session.createdAt,
      customName: session.customName,
      customColor: session.customColor,
      notes: session.notes,
      icon: session.icon,
      position: session.position || existingNode?.position || { x: 0, y: 0 },
      claudeSessionId: session.claudeSessionId,  // Persist Claude session ID for --resume
      archived: session.archived || false,
      autoResumed: session.autoResumed || false,  // Track if session was auto-resumed
      canvasId,  // Canvas/tab this agent belongs to
    });

    saveBuffer(sessionId, session.outputBuffer);
  }

  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}

export function savePositions(positions: Record<string, { x: number; y: number; canvasId?: string }>) {
  ensureDirs();
  const state = loadState();

  let updated = 0;
  for (const [nodeId, pos] of Object.entries(positions)) {
    const node = state.nodes.find(n => n.nodeId === nodeId);
    if (node) {
      node.position = { x: pos.x, y: pos.y };
      node.canvasId = pos.canvasId || node.canvasId;  // Update canvasId if provided
      updated++;
    } else {
      console.log(`\x1b[38;5;245m[persistence]\x1b[0m Node ${nodeId} not found in state`);
    }
  }

  if (updated > 0) {
    try {
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      console.log(`\x1b[38;5;245m[persistence]\x1b[0m Saved ${updated} positions to ${STATE_FILE}`);
    } catch (e) {
      console.error("Failed to save positions:", e);
    }
  }
}

export function saveBuffer(sessionId: string, buffer: string[]) {
  ensureDirs();
  const bufferFile = join(BUFFERS_DIR, `${sessionId}.txt`);
  try {
    writeFileSync(bufferFile, buffer.join(""));
  } catch (e) {
    console.error("Failed to save buffer:", e);
  }
}

export function loadBuffer(sessionId: string): string[] {
  ensureDirs();
  const bufferFile = join(BUFFERS_DIR, `${sessionId}.txt`);
  try {
    if (existsSync(bufferFile)) {
      return [readFileSync(bufferFile, "utf-8")];
    }
  } catch (e) {
    console.error("Failed to load buffer:", e);
  }
  return [];
}

export function getDataDir() {
  return DATA_DIR;
}

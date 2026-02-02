import { create } from "zustand";
import { Node } from "@xyflow/react";

export interface Canvas {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  isDefault?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  command: string;
  description: string;
  color: string;
  icon: string;
}

export type AgentStatus = "running" | "waiting_input" | "tool_calling" | "idle" | "disconnected" | "error";

export interface AgentSession {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  command: string;
  color: string;
  createdAt: string;
  cwd: string;
  originalCwd?: string; // Mother repo path when using worktrees
  gitBranch?: string;
  status: AgentStatus;
  customName?: string;
  customColor?: string;
  notes?: string;
  isRestored?: boolean;
  // Linear ticket info
  ticketId?: string;
  ticketTitle?: string;
  // Current tool being used (from plugin)
  currentTool?: string;
  // Archive status
  archived?: boolean;
}

interface AppState {
  // Config
  launchCwd: string;
  setLaunchCwd: (cwd: string) => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;

  // Sessions / Nodes
  sessions: Map<string, AgentSession>;
  addSession: (nodeId: string, session: AgentSession) => void;
  updateSession: (nodeId: string, updates: Partial<AgentSession>) => void;
  removeSession: (nodeId: string) => void;

  // Canvas
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  removeNode: (nodeId: string) => void;

  // Canvas/Tab Management
  canvases: Canvas[];
  activeCanvasId: string | null;
  setCanvases: (canvases: Canvas[]) => void;
  setActiveCanvasId: (id: string) => void;
  addCanvas: (canvas: Canvas) => void;
  updateCanvas: (id: string, updates: Partial<Canvas>) => void;
  removeCanvas: (id: string) => void;
  reorderCanvases: (canvasIds: string[]) => void;
  getNodesForCanvas: (canvasId: string) => Node[];
  moveNodeToCanvas: (nodeId: string, canvasId: string) => void;

  // UI State
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  addAgentModalOpen: boolean;
  setAddAgentModalOpen: (open: boolean) => void;
  newSessionModalOpen: boolean;
  setNewSessionModalOpen: (open: boolean) => void;
  newSessionForNodeId: string | null;
  setNewSessionForNodeId: (nodeId: string | null) => void;

  // Archive functionality
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
  archiveSession: (nodeId: string) => Promise<void>;
  unarchiveSession: (nodeId: string) => Promise<void>;
  loadState: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  // Config
  launchCwd: "",
  setLaunchCwd: (cwd) => set({ launchCwd: cwd }),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),

  // Sessions
  sessions: new Map(),
  addSession: (nodeId, session) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(nodeId, session);
      return { sessions: newSessions };
    }),
  updateSession: (nodeId, updates) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      const session = newSessions.get(nodeId);
      if (session) {
        newSessions.set(nodeId, { ...session, ...updates });
      }
      return { sessions: newSessions };
    }),
  removeSession: (nodeId) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(nodeId);
      return { sessions: newSessions };
    }),

  // Canvas
  nodes: [],
  setNodes: (nodes) => set({ nodes }),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNode: (nodeId, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n
      ),
    })),
  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
    })),

  // Canvas/Tab Management
  canvases: [],
  activeCanvasId: null,

  setCanvases: (canvases) => set({ canvases }),

  setActiveCanvasId: (id) => {
    set({ activeCanvasId: id });
    localStorage.setItem("openui-active-canvas", id);
  },

  addCanvas: (canvas) => {
    set((state) => ({ canvases: [...state.canvases, canvas] }));
  },

  updateCanvas: (id, updates) => {
    set((state) => ({
      canvases: state.canvases.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  },

  removeCanvas: (id) => {
    set((state) => ({
      canvases: state.canvases.filter((c) => c.id !== id),
      activeCanvasId:
        state.activeCanvasId === id
          ? state.canvases[0]?.id
          : state.activeCanvasId,
    }));
  },

  reorderCanvases: (canvasIds) => {
    set((state) => ({
      canvases: canvasIds
        .map((id) => state.canvases.find((c) => c.id === id))
        .filter(Boolean) as Canvas[],
    }));
  },

  getNodesForCanvas: (canvasId: string): Node[] => {
    const state = useStore.getState();
    return state.nodes.filter((n: any) => n.data?.canvasId === canvasId);
  },

  moveNodeToCanvas: (nodeId, canvasId) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, canvasId } } : n
      ),
    }));
  },

  // UI State
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  addAgentModalOpen: false,
  setAddAgentModalOpen: (open) => set({ addAgentModalOpen: open }),
  newSessionModalOpen: false,
  setNewSessionModalOpen: (open) => set({ newSessionModalOpen: open }),
  newSessionForNodeId: null,
  setNewSessionForNodeId: (nodeId) => set({ newSessionForNodeId: nodeId }),

  // Archive functionality
  showArchived: false,
  setShowArchived: (show) => set({ showArchived: show }),

  archiveSession: async (nodeId) => {
    const state = useStore.getState();
    const session = state.sessions.get(nodeId);
    if (!session) return;

    await fetch(`/api/sessions/${session.sessionId}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    // Remove from canvas
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      sessions: new Map(
        Array.from(state.sessions.entries()).map(([id, s]) =>
          id === nodeId ? [id, { ...s, archived: true }] : [id, s]
        )
      ),
    }));
  },

  unarchiveSession: async (nodeId) => {
    const state = useStore.getState();
    const session = state.sessions.get(nodeId);
    if (!session) return;

    await fetch(`/api/sessions/${session.sessionId}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    // Reload state to restore unarchived session
    // Session will appear on its original canvas (canvasId preserved)
    await useStore.getState().loadState();

    // Switch to the canvas where agent was restored
    const restoredNode = useStore.getState().nodes.find((n: any) => n.id === nodeId);
    if (restoredNode?.data?.canvasId && typeof restoredNode.data.canvasId === 'string') {
      useStore.getState().setActiveCanvasId(restoredNode.data.canvasId);
    }
  },

  loadState: async () => {
    const showArchived = useStore.getState().showArchived;
    const response = await fetch(`/api/state?archived=${showArchived}`);
    await response.json();
    // This would need to update nodes based on the loaded state
    // Implementation depends on how the app currently loads state
    // For now, a page reload might be needed to see unarchived sessions
  },
}));

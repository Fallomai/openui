import { useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  BackgroundVariant,
  ReactFlowProvider,
  NodeChange,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";

import { useStore } from "./stores/useStore";
import { AgentNode } from "./components/AgentNode/index";
import { CategoryNode } from "./components/CategoryNode";
import { Sidebar } from "./components/Sidebar";
import { NewSessionModal } from "./components/NewSessionModal";
import { Header } from "./components/Header";
import { CanvasControls } from "./components/CanvasControls";

const nodeTypes = {
  agent: AgentNode,
  category: CategoryNode,
};

function AppContent() {
  const {
    nodes: storeNodes,
    setNodes: setStoreNodes,
    setAgents,
    setLaunchCwd,
    setSelectedNodeId,
    setSidebarOpen,
    addSession,
    agents,
    addAgentModalOpen,
    setAddAgentModalOpen,
    newSessionModalOpen,
    setNewSessionModalOpen,
    newSessionForNodeId,
    setNewSessionForNodeId,
    sessions,
  } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const positionUpdateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  // Sync nodes with store
  useEffect(() => {
    setStoreNodes(nodes);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    if (storeNodes.length > 0 || hasRestoredRef.current) {
      setNodes(storeNodes);
    }
  }, [storeNodes, setNodes]);

  // Fetch config, agents, and restore state on mount
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((config) => setLaunchCwd(config.launchCwd))
      .catch(console.error);

    fetch("/api/agents")
      .then((res) => res.json())
      .then((agents) => setAgents(agents))
      .catch(console.error);
  }, [setAgents, setLaunchCwd]);

  // Restore sessions and categories after agents are loaded
  useEffect(() => {
    if (agents.length === 0 || hasRestoredRef.current) return;

    Promise.all([
      fetch("/api/sessions").then((res) => res.json()),
      fetch("/api/state").then((res) => res.json()),
      fetch("/api/categories").then((res) => res.json()),
    ])
      .then(([sessions, { nodes: savedNodes }, categories]) => {
        const restoredNodes: any[] = [];

        // Restore categories first (they should be behind agents)
        categories.forEach((cat: any) => {
          restoredNodes.push({
            id: cat.id,
            type: "category",
            position: cat.position,
            style: { width: cat.width, height: cat.height },
            data: {
              label: cat.label,
              color: cat.color,
            },
            zIndex: -1, // Behind agent nodes
          });
        });

        // Restore agent sessions
        sessions.forEach((session: any, index: number) => {
          const saved = savedNodes?.find((n: any) => n.sessionId === session.sessionId);
          const agent = agents.find((a) => a.id === session.agentId);
          const position = saved?.position?.x
            ? saved.position
            : {
                x: 100 + (index % 5) * 220,
                y: 100 + Math.floor(index / 5) * 150,
              };

          addSession(session.nodeId, {
            id: session.nodeId,
            sessionId: session.sessionId,
            agentId: session.agentId,
            agentName: session.agentName,
            command: session.command,
            color: session.customColor || agent?.color || "#888",
            createdAt: session.createdAt,
            cwd: session.cwd,
            gitBranch: session.gitBranch,
            status: session.status || "idle",
            customName: session.customName,
            customColor: session.customColor,
            notes: session.notes,
            isRestored: session.isRestored,
            ticketId: session.ticketId,
            ticketTitle: session.ticketTitle,
          });

          restoredNodes.push({
            id: session.nodeId,
            type: "agent",
            position,
            data: {
              label: session.customName || session.agentName,
              agentId: session.agentId,
              color: session.customColor || agent?.color || "#888",
              icon: agent?.icon || "cpu",
              sessionId: session.sessionId,
            },
          });
        });

        hasRestoredRef.current = true;
        setNodes(restoredNodes);
        setStoreNodes(restoredNodes);
      })
      .catch(console.error);
  }, [agents, addSession, setNodes, setStoreNodes]);

  // Helper to save all positions - accepts nodes directly to avoid sync issues
  const saveAllPositions = useCallback((nodesToSave?: typeof nodes) => {
    const currentNodes = nodesToSave || useStore.getState().nodes;
    if (currentNodes.length === 0) return;

    const positions: Record<string, { x: number; y: number }> = {};
    const GRID_SIZE = 24;
    currentNodes.forEach((node) => {
      // Only save agent positions to state/positions
      if (node.type === "agent") {
        positions[node.id] = {
          x: Math.round(node.position.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(node.position.y / GRID_SIZE) * GRID_SIZE,
        };
      }
      // Save category positions/sizes separately
      if (node.type === "category") {
        // Get dimensions - could be in style, measured, or width/height
        const width = node.measured?.width || node.width || (typeof node.style?.width === 'number' ? node.style.width : parseInt(node.style?.width as string) || 250);
        const height = node.measured?.height || node.height || (typeof node.style?.height === 'number' ? node.style.height : parseInt(node.style?.height as string) || 200);

        fetch(`/api/categories/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position: {
              x: Math.round(node.position.x / GRID_SIZE) * GRID_SIZE,
              y: Math.round(node.position.y / GRID_SIZE) * GRID_SIZE,
            },
            width,
            height,
          }),
        }).catch(console.error);
      }
    });
    if (Object.keys(positions).length > 0) {
      fetch("/api/state/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      }).catch(console.error);
    }
  }, [nodes]);

  // Save positions on window close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveAllPositions();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveAllPositions]);

  // Save positions when nodes are moved or resized
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    const positionChanges = changes.filter(
      (c) => c.type === "position" && "dragging" in c && c.dragging === false
    );
    // Check for dimension changes - resizing property might be true, false, or undefined
    const dimensionChanges = changes.filter(
      (c) => c.type === "dimensions" && (!("resizing" in c) || c.resizing === false)
    );

    if (positionChanges.length > 0 || dimensionChanges.length > 0) {
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
      }
      // Compute updated nodes immediately to avoid sync delay issues
      const updatedNodes = applyNodeChanges(changes, nodes);
      positionUpdateTimeout.current = setTimeout(() => {
        saveAllPositions(updatedNodes);
      }, 300);
    }
  }, [onNodesChange, saveAllPositions, nodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      // Only open sidebar for agent nodes
      if (node.type === "agent") {
        setSelectedNodeId(node.id);
        setSidebarOpen(true);
      }
    },
    [setSelectedNodeId, setSidebarOpen]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSidebarOpen(false);
  }, [setSelectedNodeId, setSidebarOpen]);

  const isEmpty = nodes.length === 0;

  return (
    <div className="w-screen h-screen bg-canvas overflow-hidden flex flex-col">
      <Header />

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={handleNodesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable
          nodesConnectable={false}
          snapToGrid
          snapGrid={[24, 24]}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#252525"
          />
          <Controls
            showInteractive={false}
            position="bottom-left"
          />
          <CanvasControls />
        </ReactFlow>

        {/* Empty state */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center pointer-events-auto">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-zinc-600" />
              </div>
              <h2 className="text-lg font-medium text-zinc-300 mb-2">No agents yet</h2>
              <p className="text-sm text-zinc-500 mb-4 max-w-xs">
                Spawn your first AI agent to get started
              </p>
              <button
                onClick={() => setAddAgentModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-white text-canvas font-medium text-sm hover:bg-zinc-100 transition-colors"
              >
                Create Agent
              </button>
            </div>
          </div>
        )}

        <Sidebar />
      </div>

      <NewSessionModal
        open={addAgentModalOpen || newSessionModalOpen}
        onClose={() => {
          setAddAgentModalOpen(false);
          setNewSessionModalOpen(false);
          setNewSessionForNodeId(null);
        }}
        existingSession={newSessionForNodeId ? sessions.get(newSessionForNodeId) : undefined}
        existingNodeId={newSessionForNodeId || undefined}
      />
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}

export default App;

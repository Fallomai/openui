import { useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  BackgroundVariant,
  ReactFlowProvider,
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";

import { useStore } from "./stores/useStore";
import { AgentNode } from "./components/AgentNode/index";
import { Sidebar } from "./components/Sidebar";
import { AddAgentModal } from "./components/AddAgentModal";
import { Header } from "./components/Header";
import { CanvasControls } from "./components/CanvasControls";

const nodeTypes = {
  agent: AgentNode,
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
    setAddAgentModalOpen,
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

  // Restore sessions after agents are loaded
  useEffect(() => {
    if (agents.length === 0 || hasRestoredRef.current) return;

    fetch("/api/sessions")
      .then((res) => res.json())
      .then((sessions: any[]) => {
        if (sessions.length === 0) return;
        
        return fetch("/api/state")
          .then((res) => res.json())
          .then(({ nodes: savedNodes }) => {
            const restoredNodes: any[] = [];
            
            sessions.forEach((session, index) => {
              const saved = savedNodes?.find((n: any) => n.sessionId === session.sessionId);
              const agent = agents.find(a => a.id === session.agentId);
              const position = saved?.position?.x ? saved.position : { 
                x: 100 + (index % 5) * 220, 
                y: 100 + Math.floor(index / 5) * 150 
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
                status: session.status || "idle",
                customName: session.customName,
                customColor: session.customColor,
                notes: session.notes,
                isRestored: session.isRestored,
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

            if (restoredNodes.length > 0) {
              hasRestoredRef.current = true;
              setNodes(restoredNodes);
              setStoreNodes(restoredNodes);
            }
          });
      })
      .catch(console.error);
  }, [agents, addSession, setNodes, setStoreNodes]);

  // Save positions when nodes are moved (snap to grid before saving)
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    const positionChanges = changes.filter(
      (c) => c.type === "position" && "dragging" in c && !c.dragging
    );

    if (positionChanges.length > 0) {
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
      }
      positionUpdateTimeout.current = setTimeout(() => {
        const currentNodes = useStore.getState().nodes;
        const positions: Record<string, { x: number; y: number }> = {};
        const GRID_SIZE = 24;
        currentNodes.forEach((node) => {
          // Snap to grid before saving
          positions[node.id] = {
            x: Math.round(node.position.x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(node.position.y / GRID_SIZE) * GRID_SIZE,
          };
        });
        fetch("/api/state/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positions }),
        }).catch(console.error);
      }, 500);
    }
  }, [onNodesChange]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      setSelectedNodeId(node.id);
      setSidebarOpen(true);
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
            color="#333"
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
              <div className="w-16 h-16 rounded-2xl bg-canvas-lighter border border-canvas-lighter flex items-center justify-center mx-auto mb-4">
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

      <AddAgentModal />
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

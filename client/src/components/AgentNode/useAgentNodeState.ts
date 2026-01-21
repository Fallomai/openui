import { useState, useEffect, useRef } from "react";
import { useStore, AgentStatus, AgentSession } from "../../stores/useStore";

interface AgentNodeData {
  sessionId: string;
}

export function useAgentNodeState(
  id: string,
  nodeData: AgentNodeData,
  session: AgentSession | undefined
) {
  const { removeNode, removeSession, setSelectedNodeId, setSidebarOpen, updateSession } =
    useStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<AgentStatus>(session?.status || "idle");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for status and metrics updates
  useEffect(() => {
    const sessionId = session?.sessionId || nodeData.sessionId;
    if (!sessionId) return;

    const pollData = async () => {
      try {
        // Fetch full session data which includes metrics
        const res = await fetch(`/api/sessions`);
        if (res.ok) {
          const sessions = await res.json();
          const sessionData = sessions.find((s: any) => s.sessionId === sessionId);
          if (sessionData) {
            setStatus(sessionData.status);
            updateSession(id, {
              status: sessionData.status,
              isRestored: sessionData.isRestored,
              metrics: sessionData.metrics,
              gitBranch: sessionData.gitBranch,
              ticketId: sessionData.ticketId,
              ticketTitle: sessionData.ticketTitle,
            });
          }
        }
      } catch (e) {}
    };

    pollData();
    pollIntervalRef.current = setInterval(pollData, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [session?.sessionId, nodeData.sessionId, id, updateSession]);

  useEffect(() => {
    if (session?.status) {
      setStatus(session.status);
    }
  }, [session?.status]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".context-menu-container")) {
        return;
      }
      setContextMenu(null);
    };
    if (contextMenu) {
      setTimeout(() => {
        window.addEventListener("click", handleClick);
      }, 0);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    const sessionId = session?.sessionId || nodeData.sessionId;
    if (sessionId) {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    }
    removeSession(id);
    removeNode(id);
    setSelectedNodeId(null);
    setSidebarOpen(false);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    status,
    handleContextMenu,
    handleDelete,
    closeContextMenu,
  };
}

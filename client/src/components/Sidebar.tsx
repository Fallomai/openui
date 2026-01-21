import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Terminal as TerminalIcon,
  Clock,
  Folder,
  Edit3,
  RotateCcw,
  Sparkles,
  Code,
  Cpu,
  Zap,
  Rocket,
  Bot,
  Brain,
  Wand2,
  BarChart3,
  Activity,
  DollarSign,
  FileCode,
  GitBranch,
} from "lucide-react";
import { useStore, AgentStatus } from "../stores/useStore";
import { Terminal } from "./Terminal";

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  starting: { label: "Starting", color: "#FBBF24" },
  running: { label: "Running", color: "#22C55E" },
  waiting_input: { label: "Waiting for input", color: "#FBBF24" },
  tool_calling: { label: "Tool Calling", color: "#8B5CF6" },
  idle: { label: "Idle", color: "#6B7280" },
  disconnected: { label: "Disconnected", color: "#EF4444" },
  error: { label: "Error", color: "#EF4444" },
};

const presetColors = [
  "#F97316", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#FBBF24", "#14B8A6"
];

const iconOptions = [
  { id: "sparkles", icon: Sparkles, label: "Sparkles" },
  { id: "code", icon: Code, label: "Code" },
  { id: "cpu", icon: Cpu, label: "CPU" },
  { id: "zap", icon: Zap, label: "Zap" },
  { id: "rocket", icon: Rocket, label: "Rocket" },
  { id: "bot", icon: Bot, label: "Bot" },
  { id: "brain", icon: Brain, label: "Brain" },
  { id: "wand2", icon: Wand2, label: "Wand" },
];

export function Sidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    selectedNodeId,
    sessions,
    setSelectedNodeId,
    updateSession,
    updateNode,
    nodes,
    setNewSessionModalOpen,
    setNewSessionForNodeId,
  } = useStore();

  const session = selectedNodeId ? sessions.get(selectedNodeId) : null;
  const node = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [terminalKey, setTerminalKey] = useState(0);

  // Reset edit state when session changes (but NOT when nodes change)
  useEffect(() => {
    if (session) {
      setEditName(session.customName || session.agentName);
      setEditNotes(session.notes || "");
      setEditColor(session.customColor || session.color);
      const currentNode = nodes.find(n => n.id === selectedNodeId);
      const nodeIcon = currentNode?.data?.icon;
      setEditIcon(typeof nodeIcon === 'string' ? nodeIcon : "cpu");
    }
    setIsEditing(false);
    // Force terminal recreation when session changes
    setTerminalKey(k => k + 1);
  }, [session?.sessionId]); // Removed nodes and selectedNodeId to prevent closing on updates

  const handleClose = () => {
    setSidebarOpen(false);
    setSelectedNodeId(null);
    setIsEditing(false);
  };

  const handleNewSession = () => {
    if (selectedNodeId) {
      setNewSessionForNodeId(selectedNodeId);
      setNewSessionModalOpen(true);
    }
  };

  const displayColor = editColor || session?.customColor || session?.color || "#888";
  const statusInfo = statusConfig[session?.status || "idle"];
  const isDisconnected = session?.status === "disconnected";

  return (
    <AnimatePresence>
      {sidebarOpen && session && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          className="fixed right-0 top-14 bottom-0 w-full max-w-lg z-50 flex flex-col bg-canvas-dark border-l border-canvas-lighter"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-canvas-lighter">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: displayColor }}
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-medium text-white truncate">
                  {session.customName || session.agentName}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusInfo.color }}
                  />
                  <span className="text-[10px] text-zinc-500">{statusInfo.label}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    isEditing 
                      ? "text-white bg-canvas-lighter" 
                      : "text-zinc-500 hover:text-white hover:bg-canvas-lighter"
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-canvas-lighter transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Disconnected banner */}
          {isDisconnected && (
            <div className="flex-shrink-0 px-4 py-3 bg-red-500/10 border-b border-red-500/20">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-red-400 font-medium">Session Disconnected</p>
                  <p className="text-xs text-red-400/70 mt-0.5">The agent was stopped. Start a new session.</p>
                </div>
                <button
                  onClick={handleNewSession}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  New Session
                </button>
              </div>
            </div>
          )}

          {/* Session Management Controls */}
          {!isDisconnected && !isEditing && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-canvas-lighter">
              <button
                onClick={handleNewSession}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-canvas-lighter text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                New Session
              </button>
            </div>
          )}

          {/* Edit Panel */}
          <AnimatePresence>
            {isEditing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex-shrink-0 overflow-hidden border-b border-canvas-lighter"
              >
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setEditName(newName);
                        // Instant update
                        if (selectedNodeId && session) {
                          const customName = newName !== session.agentName ? newName : undefined;
                          updateSession(selectedNodeId, { customName });
                          if (node) {
                            updateNode(selectedNodeId, {
                              data: { ...node.data, label: newName },
                            });
                          }
                          // Persist to API
                          fetch(`/api/sessions/${session.sessionId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ customName }),
                          }).catch(console.error);
                        }
                      }}
                      className="mt-1 w-full px-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Color</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {presetColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            setEditColor(color);
                            // Instant update
                            if (selectedNodeId && session) {
                              updateSession(selectedNodeId, { customColor: color });
                              if (node) {
                                updateNode(selectedNodeId, {
                                  data: { ...node.data, color },
                                });
                              }
                              // Persist to API
                              fetch(`/api/sessions/${session.sessionId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ customColor: color }),
                              }).catch(console.error);
                            }
                          }}
                          className={`w-7 h-7 rounded-md transition-all ${
                            editColor === color
                              ? "ring-2 ring-white ring-offset-2 ring-offset-canvas-dark scale-110"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Icon</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {iconOptions.map(({ id, icon: IconComponent }) => (
                        <button
                          key={id}
                          onClick={() => {
                            setEditIcon(id);
                            // Instant update
                            if (selectedNodeId && node) {
                              updateNode(selectedNodeId, {
                                data: { ...node.data, icon: id },
                              });
                            }
                          }}
                          className={`w-9 h-9 rounded-md transition-all flex items-center justify-center ${
                            editIcon === id
                              ? "ring-2 ring-white ring-offset-2 ring-offset-canvas-dark scale-110 bg-white/10"
                              : "hover:scale-110 hover:bg-white/5 bg-canvas"
                          }`}
                          style={{ borderColor: editIcon === id ? editColor : "#333", borderWidth: '1px' }}
                        >
                          <IconComponent
                            className="w-4 h-4"
                            style={{ color: editIcon === id ? editColor : "#888" }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => {
                        const newNotes = e.target.value;
                        setEditNotes(newNotes);
                        // Update with debounce would be better, but instant for now
                      }}
                      onBlur={() => {
                        // Save notes on blur
                        if (selectedNodeId && session) {
                          fetch(`/api/sessions/${session.sessionId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ notes: editNotes || undefined }),
                          }).catch(console.error);
                          updateSession(selectedNodeId, { notes: editNotes || undefined });
                        }
                      }}
                      placeholder="Add notes..."
                      rows={2}
                      className="mt-1 w-full px-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Terminal */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-shrink-0 px-4 py-2 border-b border-canvas-lighter flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Terminal</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27CA40]" />
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-[#0d0d0d]">
              <Terminal
                key={`${session.sessionId}-${terminalKey}`}
                sessionId={session.sessionId}
                color={displayColor}
                nodeId={selectedNodeId!}
              />
            </div>

            {/* Enable metrics button - shown below terminal when no metrics */}
            {session.agentId === "claude" && !session.metrics && (
              <div className="flex-shrink-0 px-3 py-2 border-t border-canvas-lighter bg-purple-500/5">
                <button
                  onClick={() => {
                    const ws = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws?sessionId=${session.sessionId}`);
                    ws.onopen = () => {
                      const prompt = `/statusline Create a statusline showing: model name, directory, lines added (+green) and removed (-red), context %, and cost. At the end include [OPENUI:{"m":"MODEL","c":COST,"la":ADDED,"lr":REMOVED,"cp":CONTEXT%,"it":IN_TOKENS,"ot":OUT_TOKENS,"s":"STATE"}] where STATE is idle/asking/working. Use jq to parse JSON. Make it colorful and readable.`;
                      ws.send(JSON.stringify({ type: "input", data: prompt + "\r" }));
                      ws.close();
                    };
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-medium hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                >
                  <BarChart3 className="w-3 h-3" />
                  Enable Metrics (statusline)
                </button>
              </div>
            )}
          </div>

          {/* Metrics Panel */}
          {session.metrics && (
            <div className="flex-shrink-0 border-t border-canvas-lighter bg-canvas-dark">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-medium text-zinc-300">Session Metrics</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Context Usage */}
                  <div className="bg-canvas rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <BarChart3 className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">Context</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(session.metrics.contextPercent, 100)}%`,
                            backgroundColor: session.metrics.contextPercent > 80 ? "#EF4444" : session.metrics.contextPercent > 50 ? "#FBBF24" : "#22C55E"
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-zinc-300">{Math.round(session.metrics.contextPercent)}%</span>
                    </div>
                  </div>

                  {/* Cost */}
                  <div className="bg-canvas rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <DollarSign className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">Cost</span>
                    </div>
                    <span className="text-sm font-mono text-zinc-300">${session.metrics.cost.toFixed(4)}</span>
                  </div>

                  {/* Lines Changed */}
                  <div className="bg-canvas rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileCode className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">Lines Changed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-green-400">+{session.metrics.linesAdded}</span>
                      <span className="text-sm font-mono text-red-400">-{session.metrics.linesRemoved}</span>
                    </div>
                  </div>

                  {/* Tokens */}
                  <div className="bg-canvas rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Activity className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">Tokens</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      <span className="text-blue-400">{(session.metrics.inputTokens / 1000).toFixed(1)}k</span>
                      {" → "}
                      <span className="text-purple-400">{(session.metrics.outputTokens / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                </div>

                {/* Reconfigure button */}
                <button
                  onClick={() => {
                    const ws = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws?sessionId=${session.sessionId}`);
                    ws.onopen = () => {
                      const prompt = `/statusline Create a statusline showing: model name, directory, lines added (+green) and removed (-red), context %, and cost. At the end include [OPENUI:{"m":"MODEL","c":COST,"la":ADDED,"lr":REMOVED,"cp":CONTEXT%,"it":IN_TOKENS,"ot":OUT_TOKENS,"s":"STATE"}] where STATE is idle/asking/working. Use jq to parse JSON. Make it colorful and readable.`;
                      ws.send(JSON.stringify({ type: "input", data: prompt + "\r" }));
                      ws.close();
                    };
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-canvas text-zinc-500 text-[10px] font-medium hover:text-zinc-300 hover:bg-canvas-lighter transition-colors"
                >
                  <BarChart3 className="w-3 h-3" />
                  Reconfigure Statusline
                </button>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="flex-shrink-0 border-t border-canvas-lighter">
            <div className="p-4 space-y-2">
              {session.notes && !isEditing && (
                <p className="text-xs text-zinc-400 italic mb-3 pb-3 border-b border-canvas-lighter">
                  {session.notes}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                <span className="text-zinc-500">Started</span>
                <span className="text-zinc-400 font-mono ml-auto">
                  {new Date(session.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Folder className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                <span className="text-zinc-500">Directory</span>
                <span className="text-zinc-400 font-mono ml-auto truncate max-w-[180px]" title={session.cwd}>
                  {session.cwd.split('/').slice(-2).join('/')}
                </span>
              </div>
              {session.gitBranch && (
                <div className="flex items-center gap-2 text-xs">
                  <GitBranch className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                  <span className="text-zinc-500">Branch</span>
                  <span className="text-purple-400 font-mono ml-auto">
                    {session.gitBranch}
                  </span>
                </div>
              )}
              {session.metrics?.model && (
                <div className="flex items-center gap-2 text-xs">
                  <Activity className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                  <span className="text-zinc-500">Model</span>
                  <span className="text-cyan-400 font-mono ml-auto">
                    {session.metrics.model}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Code, Cpu, FolderOpen, Terminal } from "lucide-react";
import { useStore, Agent } from "../stores/useStore";

const iconMap: Record<string, any> = {
  sparkles: Sparkles,
  code: Code,
  cpu: Cpu,
};

export function AddAgentModal() {
  const {
    addAgentModalOpen,
    setAddAgentModalOpen,
    agents,
    addNode,
    addSession,
    nodes,
    launchCwd,
  } = useStore();

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [cwd, setCwd] = useState("");
  const [customName, setCustomName] = useState("");
  const [commandArgs, setCommandArgs] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when modal opens
  const handleClose = () => {
    setAddAgentModalOpen(false);
    setSelectedAgent(null);
    setCwd("");
    setCustomName("");
    setCommandArgs("");
  };

  const handleCreate = async () => {
    if (!selectedAgent) return;

    setIsCreating(true);

    try {
      const nodeId = `node-${Date.now()}`;
      const workingDir = cwd || launchCwd;
      const fullCommand = commandArgs
        ? `${selectedAgent.command} ${commandArgs}`
        : selectedAgent.command;

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
          command: fullCommand,
          cwd: workingDir,
          nodeId,
          customName: customName || undefined,
        }),
      });

      const { sessionId } = await res.json();

      // Calculate position
      const nodeCount = nodes.length;
      const x = 100 + (nodeCount % 5) * 220;
      const y = 100 + Math.floor(nodeCount / 5) * 150;

      addNode({
        id: nodeId,
        type: "agent",
        position: { x, y },
        data: {
          label: customName || selectedAgent.name,
          agentId: selectedAgent.id,
          color: selectedAgent.color,
          icon: selectedAgent.icon,
          sessionId,
        },
      });

      addSession(nodeId, {
        id: nodeId,
        sessionId,
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        command: fullCommand,
        color: selectedAgent.color,
        createdAt: new Date().toISOString(),
        cwd: workingDir,
        status: "starting",
        customName: customName || undefined,
      });

      handleClose();
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {addAgentModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="rounded-lg bg-canvas-light border border-canvas-lighter shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-canvas-lighter flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">New Agent</h2>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-canvas-lighter transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Agent selection */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Select Agent</label>
                  <div className="grid grid-cols-2 gap-2">
                    {agents.map((agent) => {
                      const Icon = iconMap[agent.icon] || Cpu;
                      const isSelected = selectedAgent?.id === agent.id;

                      return (
                        <button
                          key={agent.id}
                          onClick={() => setSelectedAgent(agent)}
                          className={`relative p-3 rounded-md text-left transition-all border ${
                            isSelected
                              ? "border-white/20 bg-surface-active"
                              : "border-canvas-lighter hover:border-canvas-lighter hover:bg-surface-hover"
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center mb-2"
                            style={{ backgroundColor: `${agent.color}20` }}
                          >
                            <Icon className="w-4 h-4" style={{ color: agent.color }} />
                          </div>
                          <h3 className="text-sm font-medium text-white">{agent.name}</h3>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{agent.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom name */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Name (optional)</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={selectedAgent?.name || "My Agent"}
                    className="w-full px-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>

                {/* Command arguments */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Terminal className="w-3 h-3" />
                    Arguments (optional)
                  </label>
                  <input
                    type="text"
                    value={commandArgs}
                    onChange={(e) => setCommandArgs(e.target.value)}
                    placeholder="e.g. --model opus or --resume"
                    className="w-full px-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
                  />
                  {selectedAgent && (
                    <p className="text-[10px] text-zinc-600 font-mono">
                      {selectedAgent.command}{commandArgs ? ` ${commandArgs}` : ""}
                    </p>
                  )}
                </div>

                {/* Working directory */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <FolderOpen className="w-3 h-3" />
                    Working Directory
                  </label>
                  <input
                    type="text"
                    value={cwd}
                    onChange={(e) => setCwd(e.target.value)}
                    placeholder={launchCwd || "~/"}
                    className="w-full px-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-canvas border-t border-canvas-lighter flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  className="px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-canvas-lighter transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!selectedAgent || isCreating}
                  className="px-4 py-1.5 rounded-md text-sm font-medium text-canvas bg-white hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

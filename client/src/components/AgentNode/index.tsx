import { NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Sparkles, Code, Cpu, Zap, Rocket, Bot, Brain, Wand2 } from "lucide-react";
import { useStore } from "../../stores/useStore";
import { AgentNodeCard } from "./AgentNodeCard";
import { AgentNodeContextMenu } from "./AgentNodeContextMenu";
import { useAgentNodeState } from "./useAgentNodeState";

const iconMap: Record<string, any> = {
  sparkles: Sparkles,
  code: Code,
  cpu: Cpu,
  zap: Zap,
  rocket: Rocket,
  bot: Bot,
  brain: Brain,
  wand2: Wand2,
};

interface AgentNodeData {
  label: string;
  agentId: string;
  color: string;
  icon: string;
  sessionId: string;
}

export const AgentNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as AgentNodeData;
  const sessions = useStore((state) => state.sessions);
  const session = sessions.get(id);

  const {
    contextMenu,
    status,
    handleContextMenu,
    handleDelete,
    closeContextMenu,
  } = useAgentNodeState(id, nodeData, session);

  const displayColor = session?.customColor || session?.color || nodeData.color || "#22C55E";
  const displayName = session?.customName || session?.agentName || nodeData.label || "Agent";
  const displayIcon = nodeData.icon || "cpu";
  const Icon = iconMap[displayIcon] || Cpu;

  return (
    <>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onContextMenu={handleContextMenu}
      >
        <AgentNodeCard
          selected={selected}
          displayColor={displayColor}
          displayName={displayName}
          Icon={Icon}
          agentId={nodeData.agentId}
          status={status}
          metrics={session?.metrics}
          cwd={session?.cwd}
          gitBranch={session?.gitBranch}
          ticketId={session?.ticketId}
          ticketTitle={session?.ticketTitle}
        />
      </motion.div>

      {contextMenu && (
        <AgentNodeContextMenu
          position={contextMenu}
          onClose={closeContextMenu}
          onDelete={handleDelete}
        />
      )}
    </>
  );
};

import { MessageSquare, WifiOff, GitBranch, Folder, Wrench } from "lucide-react";
import { AgentStatus } from "../../stores/useStore";

// Status config with visual priority levels
const statusConfig: Record<AgentStatus, { label: string; color: string; bgColor: string; isActive?: boolean; needsAttention?: boolean }> = {
  running: { label: "Working", color: "#22C55E", bgColor: "#22C55E15", isActive: true },
  tool_calling: { label: "Working", color: "#22C55E", bgColor: "#22C55E15", isActive: true },
  waiting_input: { label: "Needs Input", color: "#F97316", bgColor: "#F9731620", needsAttention: true },
  idle: { label: "Idle", color: "#FBBF24", bgColor: "#FBBF2415", needsAttention: true },
  disconnected: { label: "Offline", color: "#6B7280", bgColor: "#6B728015" },
  error: { label: "Error", color: "#EF4444", bgColor: "#EF444415", needsAttention: true },
};

// Tool name display mapping
const toolDisplayNames: Record<string, string> = {
  Read: "Reading",
  Write: "Writing",
  Edit: "Editing",
  Bash: "Running",
  Grep: "Searching",
  Glob: "Finding",
  Task: "Tasking",
  WebFetch: "Fetching",
  WebSearch: "Searching",
  TodoWrite: "Planning",
  AskUserQuestion: "Asking",
};

interface AgentNodeCardProps {
  selected: boolean;
  displayColor: string;
  displayName: string;
  Icon: any;
  agentId: string;
  status: AgentStatus;
  currentTool?: string;
  cwd?: string;
  originalCwd?: string; // Mother repo path when using worktrees
  gitBranch?: string;
  ticketId?: string;
  ticketTitle?: string;
}

export function AgentNodeCard({
  selected,
  displayColor,
  displayName,
  Icon,
  agentId,
  status,
  currentTool,
  cwd,
  originalCwd,
  gitBranch,
  ticketId,
  ticketTitle,
}: AgentNodeCardProps) {
  // agentId is available for future use if needed
  void agentId;
  const statusInfo = statusConfig[status] || statusConfig.idle;
  const isActive = statusInfo.isActive;
  const isToolCalling = status === "tool_calling";
  const needsAttention = statusInfo.needsAttention;

  // Extract directory name - use originalCwd (mother repo) if available, otherwise cwd
  const displayCwd = originalCwd || cwd;
  const dirName = displayCwd ? displayCwd.split("/").pop() || displayCwd : null;

  // Get display name for current tool
  const toolDisplay = currentTool ? (toolDisplayNames[currentTool] || currentTool) : null;

  return (
    <div
      className={`relative w-[220px] rounded-lg transition-all duration-300 cursor-pointer ${
        selected ? "ring-1 ring-white/20" : ""
      }`}
      style={{
        backgroundColor: "#1a1a1a",
        border: needsAttention
          ? `2px solid ${statusInfo.color}`
          : isActive
          ? `1px solid ${statusInfo.color}40`
          : "1px solid #2a2a2a",
        boxShadow: needsAttention
          ? `0 0 16px ${statusInfo.color}40, 0 0 32px ${statusInfo.color}20, 0 4px 12px rgba(0, 0, 0, 0.4)`
          : isActive
          ? `0 0 12px ${statusInfo.color}15, 0 4px 12px rgba(0, 0, 0, 0.4)`
          : selected
          ? "0 8px 24px rgba(0, 0, 0, 0.6)"
          : "0 4px 12px rgba(0, 0, 0, 0.4)",
      }}
    >
      {/* Animated effects for different states */}
      {isActive && !needsAttention && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${statusInfo.color}20, transparent)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s ease-in-out infinite',
          }}
        />
      )}
      {/* Pulsing border for attention states */}
      {needsAttention && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            border: `2px solid ${statusInfo.color}`,
            animation: 'attention-pulse 1.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Color bar at top */}
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: displayColor }} />

      {/* Status banner */}
      <div
        className="px-3 py-1.5 flex items-center justify-between relative"
        style={{ backgroundColor: statusInfo.bgColor }}
      >
        <div className="flex items-center gap-2">
          {/* Status indicator - animated ring for active */}
          <div className="relative flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusInfo.color }}
            />
            {isActive && (
              <div
                className="absolute w-3 h-3 rounded-full animate-ping"
                style={{
                  backgroundColor: statusInfo.color,
                  opacity: 0.4,
                  animationDuration: '1.5s'
                }}
              />
            )}
          </div>
          <span className="text-xs font-medium" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </span>
          {/* Show current tool when tool_calling */}
          {isToolCalling && toolDisplay && (
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <Wrench className="w-2.5 h-2.5" />
              {toolDisplay}
            </span>
          )}
        </div>
        {status === "waiting_input" && (
          <MessageSquare className="w-3.5 h-3.5" style={{ color: statusInfo.color }} />
        )}
        {status === "disconnected" && (
          <WifiOff className="w-3.5 h-3.5" style={{ color: statusInfo.color }} />
        )}
      </div>

      <div className="p-3 relative">
        {/* Agent name and icon */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${displayColor}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: displayColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate leading-tight">{displayName}</h3>
            <p className="text-[10px] text-zinc-500">{agentId}</p>
          </div>
        </div>

        {/* Ticket/Issue info */}
        {ticketId && (
          <div className="mt-2.5 px-2 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-semibold text-blue-400">{ticketId}</span>
            </div>
            {ticketTitle && (
              <p className="text-[10px] text-blue-300/70 truncate mt-0.5">{ticketTitle}</p>
            )}
          </div>
        )}

        {/* Repo & Branch */}
        {(dirName || gitBranch) && (
          <div className="mt-2 space-y-1">
            {dirName && (
              <div className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                <span className="text-[11px] text-zinc-400 font-mono truncate">{dirName}</span>
              </div>
            )}
            {gitBranch && (
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className="text-[11px] text-purple-400 font-mono truncate">{gitBranch}</span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes attention-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

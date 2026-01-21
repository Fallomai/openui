import { MessageSquare, WifiOff, GitBranch, Loader2, Folder } from "lucide-react";
import { AgentStatus, ClaudeMetrics } from "../../stores/useStore";

const statusConfig: Record<AgentStatus, { label: string; color: string; bgColor: string; animate?: boolean; attention?: boolean }> = {
  starting: { label: "Starting", color: "#FBBF24", bgColor: "#FBBF2420", animate: true },
  running: { label: "Working", color: "#22C55E", bgColor: "#22C55E20", animate: true },
  waiting_input: { label: "Waiting for input", color: "#FBBF24", bgColor: "#FBBF2420", animate: false, attention: true },
  tool_calling: { label: "Using Tools", color: "#8B5CF6", bgColor: "#8B5CF620", animate: true },
  idle: { label: "Idle", color: "#6B7280", bgColor: "#6B728020", animate: false },
  disconnected: { label: "Offline", color: "#EF4444", bgColor: "#EF444420", animate: false, attention: true },
  error: { label: "Error", color: "#EF4444", bgColor: "#EF444420", animate: false, attention: true },
};

interface AgentNodeCardProps {
  selected: boolean;
  displayColor: string;
  displayName: string;
  Icon: any;
  agentId: string;
  status: AgentStatus;
  metrics?: ClaudeMetrics;
  cwd?: string;
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
  metrics,
  cwd,
  gitBranch,
  ticketId,
  ticketTitle,
}: AgentNodeCardProps) {
  const statusInfo = statusConfig[status] || statusConfig.idle;
  const needsAttention = statusInfo.attention;

  // Extract directory name from cwd
  const dirName = cwd ? cwd.split("/").pop() || cwd : null;

  return (
    <div
      className={`relative w-[220px] rounded-lg transition-all duration-200 cursor-pointer ${
        selected ? "ring-1 ring-white/20" : ""
      }`}
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #2a2a2a",
        boxShadow: needsAttention
          ? `0 0 0 1px ${statusInfo.color}80, 0 0 12px ${statusInfo.color}40, 0 4px 12px rgba(0, 0, 0, 0.5)`
          : selected
          ? "0 8px 24px rgba(0, 0, 0, 0.6)"
          : "0 4px 12px rgba(0, 0, 0, 0.4)",
      }}
    >
      {/* Color bar at top */}
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: displayColor }} />

      {/* Status banner - prominent when needs attention */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ backgroundColor: statusInfo.bgColor }}
      >
        <div className="flex items-center gap-2">
          {statusInfo.animate ? (
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: statusInfo.color }} />
          ) : (
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: statusInfo.color }}
            />
          )}
          <span className="text-xs font-medium" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </span>
        </div>
        {status === "waiting_input" && (
          <MessageSquare className="w-4 h-4 text-orange-500" />
        )}
        {status === "disconnected" && (
          <WifiOff className="w-4 h-4 text-red-500" />
        )}
      </div>

      <div className="p-3">
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

        {/* Ticket info (placeholder for Linear integration) */}
        {ticketId && (
          <div className="mt-2.5 px-2 py-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-semibold text-indigo-400">{ticketId}</span>
            </div>
            {ticketTitle && (
              <p className="text-[10px] text-indigo-300/70 truncate mt-0.5">{ticketTitle}</p>
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

        {/* Metrics for Claude agents - compact */}
        {metrics && agentId === "claude" && (
          <div className="mt-2.5 pt-2 border-t border-zinc-800">
            {/* Context bar - full width, more prominent */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(metrics.contextPercent, 100)}%`,
                    backgroundColor: metrics.contextPercent > 80 ? "#EF4444" : metrics.contextPercent > 50 ? "#FBBF24" : "#22C55E"
                  }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 w-8 text-right font-mono">{Math.round(metrics.contextPercent)}%</span>
            </div>

            {/* Model, Cost, Lines in one row */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-cyan-400 font-medium">{metrics.model}</span>
              <div className="flex items-center gap-2">
                <span>
                  <span className="text-green-400">+{metrics.linesAdded}</span>
                  <span className="text-zinc-600 mx-0.5">/</span>
                  <span className="text-red-400">-{metrics.linesRemoved}</span>
                </span>
                <span className="text-blue-400 font-mono">${metrics.cost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

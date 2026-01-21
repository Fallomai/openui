import { useState } from "react";
import { Plus, Folder, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "../stores/useStore";
import { SettingsModal } from "./SettingsModal";

export function Header() {
  const { setAddAgentModalOpen, sessions, launchCwd } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-canvas-lighter bg-canvas-dark">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-orange-500 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
          <span className="text-sm font-semibold text-white">OpenUI</span>
        </div>
        
        <div className="h-4 w-px bg-canvas-lighter mx-2" />
        
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Folder className="w-3 h-3" />
          <span className="font-mono truncate max-w-[200px]">{launchCwd || "~"}</span>
        </div>
      </div>

      {/* Center - Session count */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-canvas-light text-xs text-zinc-400">
          <div className={`w-1.5 h-1.5 rounded-full ${sessions.size > 0 ? 'bg-green-500' : 'bg-zinc-600'}`} />
          <span>{sessions.size} agent{sessions.size !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Right side buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-canvas-lighter transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <motion.button
          onClick={() => setAddAgentModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-canvas text-sm font-medium hover:bg-zinc-100 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          New Agent
        </motion.button>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}

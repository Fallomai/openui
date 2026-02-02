import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useStore } from "../stores/useStore";

export function CanvasControls() {
  const { setAddAgentModalOpen } = useStore();

  const handleAddAgent = () => {
    setAddAgentModalOpen(true);
  };

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <motion.button
        onClick={handleAddAgent}
        className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center text-canvas hover:bg-zinc-100 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="New Agent"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}

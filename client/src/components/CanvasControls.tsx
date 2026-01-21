import { motion } from "framer-motion";
import { Plus, FolderPlus } from "lucide-react";
import { useStore } from "../stores/useStore";

const CATEGORY_COLORS = ["#F97316", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"];

export function CanvasControls() {
  const { setAddAgentModalOpen, nodes, addNode } = useStore();

  const handleAddAgent = () => {
    setAddAgentModalOpen(true);
  };

  const handleAddCategory = async () => {
    const id = `category-${Date.now()}`;
    const color = CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];

    // Find a good position (offset from existing nodes)
    const categoryCount = nodes.filter(n => n.type === "category").length;
    const position = {
      x: 50 + (categoryCount % 3) * 300,
      y: 50 + Math.floor(categoryCount / 3) * 250,
    };

    const category = {
      id,
      label: "New Category",
      color,
      position,
      width: 250,
      height: 200,
    };

    // Save to server
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category),
    });

    // Add to canvas
    addNode({
      id,
      type: "category",
      position,
      style: { width: 250, height: 200 },
      data: {
        label: "New Category",
        color,
      },
      zIndex: -1,
    });
  };

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
      <motion.button
        onClick={handleAddCategory}
        className="w-10 h-10 rounded-full bg-surface border border-border shadow-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-surface-hover transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="New Category"
      >
        <FolderPlus className="w-5 h-5" />
      </motion.button>
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

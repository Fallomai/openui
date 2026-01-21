import { useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { Trash2, Palette } from "lucide-react";
import { useStore } from "../stores/useStore";

const CATEGORY_COLORS = ["#F97316", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444", "#FBBF24"];

interface CategoryNodeData {
  label: string;
  color: string;
}

export function CategoryNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as CategoryNodeData;
  const { updateNode, removeNode } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [label, setLabel] = useState(nodeData.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(nodeData.label);
  }, [nodeData.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveCategory = (updates: { label?: string; color?: string }) => {
    fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch(console.error);

    // Also update the node data in store
    updateNode(id, {
      data: { ...nodeData, ...updates },
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (label !== nodeData.label) {
      saveCategory({ label });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
    if (e.key === "Escape") {
      setLabel(nodeData.label);
      setIsEditing(false);
    }
  };

  const handleColorChange = (color: string) => {
    saveCategory({ color });
    setShowColorPicker(false);
  };

  const handleDelete = async () => {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    removeNode(id);
  };

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-white/20"
        handleClassName="h-2 w-2 bg-white/50 border border-white/80"
      />
      <div
        className="w-full h-full rounded-lg border-2 border-dashed"
        style={{
          backgroundColor: `${nodeData.color}10`,
          borderColor: `${nodeData.color}40`,
          minWidth: 150,
          minHeight: 100,
        }}
      >
        <div
          className="px-2 py-1 flex items-center justify-between gap-1"
          style={{ backgroundColor: `${nodeData.color}20` }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-xs font-medium outline-none flex-1 min-w-0"
              style={{ color: nodeData.color }}
            />
          ) : (
            <span
              className="text-xs font-medium cursor-text flex-1 min-w-0 truncate"
              style={{ color: nodeData.color }}
              onDoubleClick={handleDoubleClick}
            >
              {nodeData.label}
            </span>
          )}
          {selected && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <Palette className="w-3 h-3 text-zinc-500 hover:text-white" />
                </button>
                {showColorPicker && (
                  <div className="absolute top-full left-0 mt-1 p-1.5 bg-surface border border-border rounded-md shadow-lg flex gap-1 z-50">
                    {CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(color)}
                        className="w-4 h-4 rounded-sm hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleDelete}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <Trash2 className="w-3 h-3 text-zinc-500 hover:text-red-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

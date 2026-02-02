import { Plus, X, Edit2 } from "lucide-react";
import { useStore } from "../stores/useStore";
import { useState } from "react";

export function CanvasTabs() {
  const { canvases, activeCanvasId, setActiveCanvasId, addCanvas, updateCanvas, removeCanvas } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAddCanvas = () => {
    const newCanvas = {
      id: `canvas-${Date.now()}`,
      name: `Canvas ${canvases.length + 1}`,
      color: "#3B82F6",
      order: canvases.length,
      createdAt: new Date().toISOString(),
    };

    fetch("/api/canvases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCanvas),
    }).then(() => {
      addCanvas(newCanvas);
      setActiveCanvasId(newCanvas.id);
    });
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;

    fetch(`/api/canvases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    }).then(() => {
      updateCanvas(id, { name: editName.trim() });
      setEditingId(null);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this canvas? Move agents to another canvas first.")) return;

    fetch(`/api/canvases/${id}`, {
      method: "DELETE",
    }).then((res) => {
      if (res.ok) {
        removeCanvas(id);
      } else {
        res.json().then((data) => alert(data.error));
      }
    });
  };

  return (
    <div className="fixed top-14 left-0 right-0 h-11 bg-surface border-b border-border flex items-center px-4 gap-2 z-40">
      {canvases.map((canvas: any) => (
        <div
          key={canvas.id}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-t border-b-2 cursor-pointer transition-colors ${
            activeCanvasId === canvas.id
              ? "bg-canvas border-primary text-white"
              : "bg-surface-hover border-transparent text-zinc-400 hover:text-white"
          }`}
          onClick={() => setActiveCanvasId(canvas.id)}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: canvas.color }}
          />

          {editingId === canvas.id ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(canvas.id)}
              onKeyDown={(e) => e.key === "Enter" && handleRename(canvas.id)}
              className="bg-transparent border-b border-primary outline-none text-sm w-24"
              autoFocus
            />
          ) : (
            <>
              <span className="text-sm font-medium">{canvas.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(canvas.id);
                  setEditName(canvas.name);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-primary"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </>
          )}

          {canvases.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(canvas.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      <button
        onClick={handleAddCanvas}
        className="flex items-center gap-1 px-2 py-1.5 rounded text-zinc-400 hover:text-white hover:bg-surface-hover transition-colors"
        title="Add Canvas"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">New Canvas</span>
      </button>
    </div>
  );
}

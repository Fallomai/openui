import { useState, useEffect, useRef } from "react";
import { GripVertical } from "lucide-react";

interface ResizeHandleProps {
  onResize: (width: number) => void;
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

export function ResizeHandle({
  onResize,
  initialWidth,
  minWidth = 320,
  maxWidth = 1200
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(initialWidth);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidthRef.current + deltaX)
      );
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onResize, minWidth, maxWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = initialWidth;
  };

  return (
    <div
      className="group absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-50 flex items-center justify-center"
      onMouseDown={handleMouseDown}
    >
      {/* Hover/drag background */}
      <div
        className={`absolute inset-0 transition-all ${
          isDragging
            ? "bg-blue-500/50"
            : "bg-transparent group-hover:bg-blue-500/30"
        }`}
      />

      {/* Grip indicator - visible on hover or drag */}
      <div
        className={`relative z-10 flex items-center justify-center w-6 h-12 rounded-md transition-all ${
          isDragging
            ? "bg-blue-500/70 opacity-100"
            : "bg-zinc-700/80 opacity-0 group-hover:opacity-100"
        }`}
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from "react";

interface UseResizableOptions {
  minPercent?: number;
  maxPercent?: number;
  onResize?: (percent: number) => void;
}

interface UseResizableReturn {
  isDragging: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

export function useResizable({
  minPercent = 20,
  maxPercent = 60,
  onResize,
}: UseResizableOptions = {}): UseResizableReturn {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate percentage: sidebar is on the right, so width = distance from mouse to right edge
      const percent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      const clampedPercent = Math.min(maxPercent, Math.max(minPercent, percent));
      onResize?.(clampedPercent);
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
  }, [isDragging, minPercent, maxPercent, onResize]);

  // Prevent text selection and set cursor globally during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  return { isDragging, handleMouseDown };
}

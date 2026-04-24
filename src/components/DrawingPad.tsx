import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pencil, Eraser, Trash2 } from "lucide-react";

export interface DrawingPadHandle {
  clear: () => void;
}

interface DrawingPadProps {
  onStrokeEnd?: () => void;
  className?: string;
  height?: number;
}

const COLORS = [
  "#1a1a2e", "#e94560", "#f39c12", "#27ae60",
  "#3498db", "#9b59b6", "#e67e22", "#ec407a",
];

const DrawingPad = forwardRef<DrawingPadHandle, DrawingPadProps>(
  ({ onStrokeEnd, className = "", height = 480 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const drawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const [color, setColor] = useState(COLORS[0]);
    const [size, setSize] = useState(4);
    const [tool, setTool] = useState<"pen" | "eraser">("pen");

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    useImperativeHandle(ref, () => ({ clear }));

    // Resize canvas to container
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const resize = () => {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        // Preserve current image
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = canvas.height;
        const tctx = tmp.getContext("2d");
        if (tctx && canvas.width && canvas.height) tctx.drawImage(canvas, 0, 0);

        canvas.width = rect.width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, height);
        if (tctx && tmp.width) ctx.drawImage(tmp, 0, 0, rect.width, height);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      };

      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }, [height]);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPosRef.current = getPos(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !lastPosRef.current) return;
      const pos = getPos(e);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? size * 3 : size;
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    };

    const handlePointerUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPosRef.current = null;
      onStrokeEnd?.();
    };

    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-card border-2 shadow-sm">
          <Button
            type="button"
            size="sm"
            variant={tool === "pen" ? "fun" : "outline"}
            onClick={() => setTool("pen")}
          >
            <Pencil className="w-4 h-4" /> Pen
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tool === "eraser" ? "fun" : "outline"}
            onClick={() => setTool("eraser")}
          >
            <Eraser className="w-4 h-4" /> Eraser
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setColor(c); setTool("pen"); }}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === c && tool === "pen" ? "border-foreground scale-110" : "border-border"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="h-6 w-px bg-border mx-1" />
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="text-xs text-muted-foreground">Size</span>
            <Slider value={[size]} onValueChange={(v) => setSize(v[0])} min={1} max={20} step={1} />
            <span className="text-xs w-6 text-right tabular-nums">{size}</span>
          </div>
          <div className="ml-auto">
            <Button type="button" size="sm" variant="outline" onClick={clear}>
              <Trash2 className="w-4 h-4" /> Clear
            </Button>
          </div>
        </div>

        <div ref={containerRef} className="rounded-2xl overflow-hidden border-2 shadow-fun bg-white">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="block touch-none cursor-crosshair"
          />
        </div>
      </div>
    );
  }
);

DrawingPad.displayName = "DrawingPad";
export default DrawingPad;
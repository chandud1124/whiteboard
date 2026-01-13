import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, Download, Trash2, ZoomIn, ZoomOut, Move, Type, Minus } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface User {
  username: string;
  id: number;
}

interface Point {
  x: number;
  y: number;
}

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [tool, setTool] = useState("pen");
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState<Point>({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(storedUser));

    initializeCanvas();
    window.addEventListener("resize", handleResize);
    
    return () => window.removeEventListener("resize", handleResize);
  }, [navigate]);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Use full container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      saveToHistory();
    }
  };

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const imageData = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use full container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
      
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;
    
    return { x, y };
  };

  const transformContext = (ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
  };

  const drawLine = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    ctx.save();
    transformContext(ctx);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / zoom;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const drawRectangle = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    ctx.save();
    transformContext(ctx);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / zoom;
    ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    ctx.restore();
  };

  const drawCircle = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    ctx.save();
    transformContext(ctx);
    const radius = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / zoom;
    ctx.beginPath();
    ctx.arc(from.x, from.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    
    if (tool === "pan") {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    setIsDrawing(true);
    setStartPoint(point);

    if (tool === "pen" || tool === "eraser") {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        ctx.save();
        transformContext(ctx);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.restore();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update cursor position for eraser visual
    if (tool === "eraser") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }

    if (isPanning && tool === "pan") {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      redrawCanvas();
      return;
    }

    if (!isDrawing) return;

    const point = getCanvasPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    if (tool === "pen") {
      ctx.save();
      transformContext(ctx);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth / zoom;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();
    } else if (tool === "eraser") {
      ctx.save();
      transformContext(ctx);
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = (strokeWidth * 2) / zoom;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    } else if (tool === "line" || tool === "rectangle" || tool === "circle") {
      restoreFromHistory();
      
      if (tool === "line") {
        drawLine(ctx, startPoint, point);
      } else if (tool === "rectangle") {
        drawRectangle(ctx, startPoint, point);
      } else if (tool === "circle") {
        drawCircle(ctx, startPoint, point);
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || historyIndex < 0) return;

    const currentImage = history[historyIndex];
    if (!currentImage) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    transformContext(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(currentImage, 0, 0);
    ctx.restore();
  };

  const restoreFromHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || historyIndex < 0) return;

    const imageData = history[historyIndex];
    if (imageData) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && history[historyIndex - 1]) {
        ctx.putImageData(history[historyIndex - 1], 0, 0);
      }
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && history[historyIndex + 1]) {
        ctx.putImageData(history[historyIndex + 1], 0, 0);
      }
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 5));
    setTimeout(() => redrawCanvas(), 10);
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.2));
    setTimeout(() => redrawCanvas(), 10);
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    redrawCanvas();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `whiteboard-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!user) return null;

  const colorPresets = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500"];

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white shadow-sm px-6 py-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Collaborative Whiteboard</h1>
          <p className="text-sm text-gray-500">Welcome, {user.username}</p>
        </div>
        <Button variant="outline" onClick={handleLogout} size="sm">
          Logout
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-white shadow-sm px-6 py-3 flex-shrink-0">
        {/* Drawing Tools */}
        <div className="flex gap-2 border-r pr-3">
          <Button
            variant={tool === "pen" ? "default" : "outline"}
            onClick={() => setTool("pen")}
            size="sm"
            title="Pen (P)"
          >
            ✏️ Pen
          </Button>
          <Button
            variant={tool === "line" ? "default" : "outline"}
            onClick={() => setTool("line")}
            size="sm"
            title="Line (L)"
          >
            <Minus className="w-4 h-4" /> Line
          </Button>
          <Button
            variant={tool === "rectangle" ? "default" : "outline"}
            onClick={() => setTool("rectangle")}
            size="sm"
            title="Rectangle (R)"
          >
            ▭ Rect
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "outline"}
            onClick={() => setTool("circle")}
            size="sm"
            title="Circle (C)"
          >
            ⭕ Circle
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            onClick={() => setTool("eraser")}
            size="sm"
            title="Eraser (E)"
          >
            🧹 Eraser
          </Button>
          <Button
            variant={tool === "pan" ? "default" : "outline"}
            onClick={() => setTool("pan")}
            size="sm"
            title="Pan (H)"
          >
            <Move className="w-4 h-4" /> Pan
          </Button>
        </div>

        {/* Color Selection */}
        <div className="flex items-center gap-2 border-r pr-3">
          <label className="text-sm font-medium text-gray-700">Color:</label>
          <div className="flex gap-1">
            {colorPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setColor(preset)}
                className={`w-7 h-7 rounded border-2 transition-all ${
                  color === preset ? "border-gray-800 scale-110" : "border-gray-300"
                }`}
                style={{ backgroundColor: preset }}
                title={preset}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-7 h-7 cursor-pointer rounded border-2 border-gray-300"
              title="Custom Color"
            />
          </div>
        </div>

        {/* Stroke Width */}
        <div className="flex items-center gap-2 border-r pr-3">
          <label className="text-sm font-medium text-gray-700">Size:</label>
          <Slider
            value={[strokeWidth]}
            onValueChange={([value]) => setStrokeWidth(value)}
            min={1}
            max={30}
            step={1}
            className="w-24"
          />
          <span className="text-sm font-medium text-gray-600 w-8">{strokeWidth}</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 border-r pr-3">
          <Button variant="outline" onClick={handleZoomOut} size="sm" title="Zoom Out (-)">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-600 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" onClick={handleZoomIn} size="sm" title="Zoom In (+)">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleResetZoom} size="sm" title="Reset View">
            Reset
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={undo} disabled={historyIndex <= 0} size="sm" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1} size="sm" title="Redo (Ctrl+Y)">
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button variant="destructive" onClick={handleClear} size="sm" title="Clear Canvas">
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
          <Button variant="outline" onClick={handleDownload} size="sm" title="Download">
            <Download className="w-4 h-4" /> Save
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden" style={{ minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full h-full ${
            tool === "pan" 
              ? "cursor-grab active:cursor-grabbing" 
              : tool === "eraser"
              ? "cursor-none"
              : "cursor-crosshair"
          }`}
        />
        {tool === "eraser" && (
          <div
            className="pointer-events-none fixed border-2 border-gray-800 rounded-full"
            style={{
              width: strokeWidth * 2 * zoom,
              height: strokeWidth * 2 * zoom,
              transform: "translate(-50%, -50%)",
              left: "var(--mouse-x)",
              top: "var(--mouse-y)",
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t bg-white px-6 py-2 text-sm text-gray-600 flex-shrink-0">
        <div>
          Tool: <span className="font-medium capitalize">{tool}</span> | 
          Size: <span className="font-medium">{strokeWidth}px</span> | 
          Zoom: <span className="font-medium">{Math.round(zoom * 100)}%</span>
        </div>
        <div>
          History: {historyIndex + 1} / {history.length}
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;

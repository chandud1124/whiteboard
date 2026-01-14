import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, Download, Trash2, ZoomIn, ZoomOut, Move, Type, Minus, ArrowRight, Grid3x3, Highlighter } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState<Point>({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [showMinimap, setShowMinimap] = useState(true);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [eraserCursorPos, setEraserCursorPos] = useState<Point>({ x: 0, y: 0 });
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
    
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Shift key tracking
      if (e.key === "Shift") {
        setIsShiftPressed(true);
      }
      
      // Tool shortcuts
      if (e.key.toLowerCase() === "p") setTool("pen");
      if (e.key.toLowerCase() === "l") setTool("line");
      if (e.key.toLowerCase() === "r") setTool("rectangle");
      if (e.key.toLowerCase() === "c") setTool("circle");
      if (e.key.toLowerCase() === "e") setTool("eraser");
      if (e.key.toLowerCase() === "h") setTool("pan");
      if (e.key.toLowerCase() === "a") setTool("arrow");
      if (e.key.toLowerCase() === "m") setTool("highlighter");
      if (e.key.toLowerCase() === "g") setShowGrid(prev => !prev);
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
      
      // Zoom
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      }
      if (e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftPressed(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [navigate, historyIndex, history.length]);

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

    const imageData = canvas.getContext("2d", { willReadFrequently: true })?.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use full container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
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
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    updateMinimap();
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let x = (e.clientX - rect.left - panOffset.x) / zoom;
    let y = (e.clientY - rect.top - panOffset.y) / zoom;
    
    // Snap to grid if enabled
    if (snapToGrid && showGrid) {
      const gridSize = 20;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }
    
    return { x, y };
  };

  const transformContext = (ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
  };

  const applyLineStyle = (ctx: CanvasRenderingContext2D) => {
    if (lineStyle === "dashed") {
      ctx.setLineDash([10, 5]);
    } else if (lineStyle === "dotted") {
      ctx.setLineDash([2, 3]);
    } else {
      ctx.setLineDash([]);
    }
  };

  const drawLine = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    // Apply shift constraint for straight lines
    let endPoint = to;
    if (isShiftPressed) {
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);
      if (dx > dy) {
        endPoint = { x: to.x, y: from.y }; // Horizontal
      } else {
        endPoint = { x: from.x, y: to.y }; // Vertical
      }
    }
    
    ctx.save();
    transformContext(ctx);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / zoom;
    applyLineStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
    ctx.restore();
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    // Apply shift constraint
    let endPoint = to;
    if (isShiftPressed) {
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);
      if (dx > dy) {
        endPoint = { x: to.x, y: from.y };
      } else {
        endPoint = { x: from.x, y: to.y };
      }
    }
    
    ctx.save();
    transformContext(ctx);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth / zoom;
    applyLineStyle(ctx);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(endPoint.y - from.y, endPoint.x - from.x);
    const arrowLength = 15 / zoom;
    const arrowWidth = 8 / zoom;
    
    ctx.beginPath();
    ctx.moveTo(endPoint.x, endPoint.y);
    ctx.lineTo(
      endPoint.x - arrowLength * Math.cos(angle - Math.PI / 6),
      endPoint.y - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      endPoint.x - arrowLength * Math.cos(angle + Math.PI / 6),
      endPoint.y - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawRectangle = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    let endPoint = to;
    // Apply shift constraint for squares
    if (isShiftPressed) {
      const size = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      endPoint = {
        x: from.x + (to.x > from.x ? size : -size),
        y: from.y + (to.y > from.y ? size : -size)
      };
    }
    
    ctx.save();
    transformContext(ctx);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / zoom;
    applyLineStyle(ctx);
    ctx.strokeRect(from.x, from.y, endPoint.x - from.x, endPoint.y - from.y);
    ctx.restore();
  };

  const drawCircle = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    ctx.save();
    transformContext(ctx);
    
    let radius = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    
    // Apply shift constraint for perfect circles (use distance in one direction)
    if (isShiftPressed) {
      radius = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / zoom;
    applyLineStyle(ctx);
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

    if (tool === "pen" || tool === "eraser" || tool === "highlighter") {
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
        // Store the absolute position relative to viewport
        setEraserCursorPos({ x: e.clientX, y: e.clientY });
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
    } else if (tool === "highlighter") {
      ctx.save();
      transformContext(ctx);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3; // Semi-transparent
      ctx.lineWidth = (strokeWidth * 3) / zoom; // Wider than pen
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
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
    } else if (tool === "line" || tool === "arrow" || tool === "rectangle" || tool === "circle") {
      restoreFromHistory();
      
      if (tool === "line") {
        drawLine(ctx, startPoint, point);
      } else if (tool === "arrow") {
        drawArrow(ctx, startPoint, point);
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
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
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
    
    updateMinimap();
  };

  const updateMinimap = () => {
    const canvas = canvasRef.current;
    const minimap = minimapRef.current;
    if (!canvas || !minimap) return;

    const minimapCtx = minimap.getContext("2d", { willReadFrequently: true });
    if (!minimapCtx) return;

    const scale = 0.15; // Minimap scale
    minimap.width = canvas.width * scale;
    minimap.height = canvas.height * scale;

    // Draw the main canvas content
    minimapCtx.drawImage(canvas, 0, 0, minimap.width, minimap.height);

    // Draw viewport rectangle
    minimapCtx.strokeStyle = "#3b82f6";
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(
      -panOffset.x * scale / zoom,
      -panOffset.y * scale / zoom,
      (canvas.width / zoom) * scale,
      (canvas.height / zoom) * scale
    );
  };

  const restoreFromHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
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
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-3 border-b bg-white shadow-sm px-6 py-3 flex-shrink-0">
          {/* Drawing Tools */}
          <div className="flex gap-2 border-r pr-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "pen" ? "default" : "outline"}
                  onClick={() => setTool("pen")}
                  size="sm"
                  className={tool === "pen" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  ✏️ Pen
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Pen Tool (P)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "highlighter" ? "default" : "outline"}
                  onClick={() => setTool("highlighter")}
                  size="sm"
                  className={tool === "highlighter" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  <Highlighter className="w-4 h-4" /> Highlight
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Highlighter (M)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "line" ? "default" : "outline"}
                  onClick={() => setTool("line")}
                  size="sm"
                  className={tool === "line" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  <Minus className="w-4 h-4" /> Line
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Line Tool (L) - Hold Shift for straight lines</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "arrow" ? "default" : "outline"}
                  onClick={() => setTool("arrow")}
                  size="sm"
                  className={tool === "arrow" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  <ArrowRight className="w-4 h-4" /> Arrow
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Arrow Tool (A)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "rectangle" ? "default" : "outline"}
                  onClick={() => setTool("rectangle")}
                  size="sm"
                  className={tool === "rectangle" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  ▭ Rect
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Rectangle (R) - Hold Shift for squares</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "circle" ? "default" : "outline"}
                  onClick={() => setTool("circle")}
                  size="sm"
                  className={tool === "circle" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  ⭕ Circle
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Circle (C) - Hold Shift for perfect circles</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "eraser" ? "default" : "outline"}
                  onClick={() => setTool("eraser")}
                  size="sm"
                  className={tool === "eraser" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  🧹 Eraser
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Eraser (E)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === "pan" ? "default" : "outline"}
                  onClick={() => setTool("pan")}
                  size="sm"
                  className={tool === "pan" ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                >
                  <Move className="w-4 h-4" /> Pan
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Pan Tool (H)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Line Style */}
          <div className="flex gap-2 border-r pr-3">
            <Button
              variant={lineStyle === "solid" ? "default" : "outline"}
              onClick={() => setLineStyle("solid")}
              size="sm"
            >
              ━
            </Button>
            <Button
              variant={lineStyle === "dashed" ? "default" : "outline"}
              onClick={() => setLineStyle("dashed")}
              size="sm"
            >
              ╌
            </Button>
            <Button
              variant={lineStyle === "dotted" ? "default" : "outline"}
              onClick={() => setLineStyle("dotted")}
              size="sm"
            >
              ┄
            </Button>
          </div>

          {/* Grid Controls */}
          <div className="flex gap-2 border-r pr-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showGrid ? "default" : "outline"}
                  onClick={() => setShowGrid(!showGrid)}
                  size="sm"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Grid (G)</p>
              </TooltipContent>
            </Tooltip>
            
            {showGrid && (
              <Button
                variant={snapToGrid ? "default" : "outline"}
                onClick={() => setSnapToGrid(!snapToGrid)}
                size="sm"
              >
                Snap
              </Button>
            )}
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
                    color === preset ? "border-gray-800 scale-110 ring-2 ring-offset-1 ring-blue-400" : "border-gray-300"
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleZoomOut} size="sm">
                  <ZoomOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom Out (-)</p>
              </TooltipContent>
            </Tooltip>
            
            <span className="text-sm font-medium text-gray-600 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleZoomIn} size="sm">
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom In (+)</p>
              </TooltipContent>
            </Tooltip>
            
            <Button variant="outline" onClick={handleResetZoom} size="sm">
              Reset
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={undo} disabled={historyIndex <= 0} size="sm">
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo (Ctrl+Z)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1} size="sm">
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo (Ctrl+Y)</p>
              </TooltipContent>
            </Tooltip>
            
            <Button variant="destructive" onClick={handleClear} size="sm">
              <Trash2 className="w-4 h-4" /> Clear
            </Button>
            <Button variant="outline" onClick={handleDownload} size="sm">
              <Download className="w-4 h-4" /> Save
            </Button>
          </div>
        </div>
      </TooltipProvider>

      {/* Canvas Container */}
      <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden" style={{ minHeight: 0 }}>
        {/* Grid Background */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #e0e0e0 1px, transparent 1px),
                linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)
              `,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
            }}
          />
        )}
        
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
              left: eraserCursorPos.x,
              top: eraserCursorPos.y,
            }}
          />
        )}
        
        {/* Mini-map */}
        {showMinimap && (
          <div className="absolute bottom-4 right-4 bg-white border-2 border-gray-300 shadow-lg rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-gray-100 px-2 py-1 border-b">
              <span className="text-xs font-medium text-gray-600">Mini-map</span>
              <button
                onClick={() => setShowMinimap(false)}
                className="text-gray-500 hover:text-gray-700 text-xs"
              >
                ✕
              </button>
            </div>
            <canvas
              ref={minimapRef}
              className="cursor-pointer"
              style={{ maxWidth: "200px", maxHeight: "150px" }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t bg-white px-6 py-2 text-sm text-gray-600 flex-shrink-0">
        <div>
          Tool: <span className="font-medium capitalize">{tool}</span> | 
          Size: <span className="font-medium">{strokeWidth}px</span> | 
          Zoom: <span className="font-medium">{Math.round(zoom * 100)}%</span>
          {isShiftPressed && <span className="ml-2 text-blue-500 font-medium">⇧ Shift Constrained</span>}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className="hover:text-gray-900 underline"
          >
            {showMinimap ? "Hide" : "Show"} Mini-map
          </button>
          <span>
            History: {historyIndex + 1} / {history.length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;

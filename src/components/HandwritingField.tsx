import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pen, Eraser, RotateCcw, ScanText } from "lucide-react";
import { toast } from "sonner";
import { dbClient } from "@/lib/api/client";

export interface HandwritingValue {
  /** PNG data URL of the strokes on transparent background */
  image?: string;
  /** OCR-erkannter Text (optional) */
  text?: string;
  /** ISO timestamp der letzten Änderung */
  updated_at?: string;
}

interface Props {
  value?: HandwritingValue;
  onChange?: (v: HandwritingValue) => void;
  readOnly?: boolean;
  height?: number;
}

/**
 * Reusable Handschrift-Feld. Erfasst Zeichnungen per Maus/Touch/Stylus,
 * speichert das Ergebnis als PNG Data-URL und ruft optional die
 * Edge Function `handwriting-ocr` auf, um den erkannten Text zu speichern.
 */
export default function HandwritingField({ value, onChange, readOnly, height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const [ocrLoading, setOcrLoading] = useState(false);

  // Restore existing image on mount / value change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value?.image) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value.image;
    }
  }, [value?.image]);

  const localCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = localCoords(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || readOnly) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pt = localCoords(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (mode === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.2;
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 18;
    }
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    last.current = pt;
  };

  const commit = () => {
    const canvas = canvasRef.current!;
    const image = canvas.toDataURL("image/png");
    onChange?.({ ...value, image, updated_at: new Date().toISOString() });
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    commit();
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.({ image: undefined, text: undefined, updated_at: new Date().toISOString() });
  };

  const runOcr = async () => {
    if (!value?.image) {
      toast.error("Keine Handschrift zum Erkennen");
      return;
    }
    setOcrLoading(true);
    try {
      const { data, error } = await dbClient.functions.invoke("handwriting-ocr", {
        body: { image: value.image },
      });
      if (error) throw error;
      const text = (data?.text ?? "").trim();
      onChange?.({ ...value, text, updated_at: new Date().toISOString() });
      toast.success(text ? "Text erkannt" : "Kein Text erkannt");
    } catch (e: any) {
      toast.error("OCR fehlgeschlagen", { description: e.message ?? String(e) });
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="sm"
            variant={mode === "pen" ? "default" : "outline"}
            onClick={() => setMode("pen")}
            className="h-7 text-xs"
          >
            <Pen className="h-3 w-3 mr-1" /> Stift
          </Button>
          <Button
            size="sm"
            variant={mode === "eraser" ? "default" : "outline"}
            onClick={() => setMode("eraser")}
            className="h-7 text-xs"
          >
            <Eraser className="h-3 w-3 mr-1" /> Radierer
          </Button>
          <Button size="sm" variant="outline" onClick={clear} className="h-7 text-xs">
            <RotateCcw className="h-3 w-3 mr-1" /> Leeren
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={runOcr}
            disabled={ocrLoading || !value?.image}
            className="h-7 text-xs ml-auto"
          >
            <ScanText className="h-3 w-3 mr-1" />
            {ocrLoading ? "Erkenne …" : "Text erkennen"}
          </Button>
        </div>
      )}
      <Card className="p-0 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={800}
          height={height * 4}
          style={{ height, width: "100%", touchAction: "none", display: "block" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </Card>
      {value?.text && (
        <div className="text-xs bg-muted/50 rounded-md p-2">
          <span className="font-medium">Erkannter Text: </span>
          <span className="whitespace-pre-wrap">{value.text}</span>
        </div>
      )}
    </div>
  );
}

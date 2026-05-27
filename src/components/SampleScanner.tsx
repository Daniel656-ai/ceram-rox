import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ScanLine, Camera } from "lucide-react";

export function SampleScannerInput() {
  const { t } = useTranslation("samples");
  const navigate = useNavigate();
  const [scanValue, setScanValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Check if it's a URL containing /proben/
    const urlMatch = trimmed.match(/\/proben\/([a-f0-9-]+)/i);
    if (urlMatch) {
      navigate(`/proben/${urlMatch[1]}`);
      setScanValue("");
      return;
    }

    // Otherwise treat as sample_number
    const { data } = await api
      .from("samples")
      .select("id")
      .eq("sample_number", trimmed)
      .maybeSingle();

    if (data) {
      navigate(`/proben/${data.id}`);
      setScanValue("");
    } else {
      toast.error(t("scan_not_found"));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanValue);
    }
  };

  return (
    <div className="relative max-w-sm">
      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={scanValue}
        onChange={e => setScanValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("scan_placeholder")}
        className="pl-9"
      />
    </div>
  );
}

export function SampleCameraScanner() {
  const { t } = useTranslation("samples");
  const _navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        toast.error(t("camera_error"));
      }
    };
    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Camera className="h-4 w-4 mr-1" />{t("scan_camera")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("scan_camera")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md" />
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-sm text-muted-foreground text-center">{t("scan_camera_hint")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

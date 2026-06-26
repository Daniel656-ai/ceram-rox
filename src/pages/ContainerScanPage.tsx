import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { ScanLine, ArrowLeft, Package, MapPin, ExternalLink, AlertTriangle, RotateCcw, X, History as HistoryIcon } from "lucide-react";
import { ContainerActionsDialog } from "@/components/ContainerActionsDialog";
import type { ContainerMovementType } from "@/lib/api/containerMovements";
import { GhsPictogramList } from "@/components/GhsPictogram";
import { PsaSymbolList } from "@/components/PsaSymbolList";

// Erlaubt: Buchstaben, Ziffern, - _ . / (typische Barcode-Symbologien)
const barcodeSchema = z.string()
  .trim()
  .min(2, "Code zu kurz (min. 2 Zeichen)")
  .max(100, "Code zu lang (max. 100 Zeichen)")
  .regex(/^[A-Za-z0-9\-_.\/]+$/, "Ungültige Zeichen im Barcode (erlaubt: A–Z, 0–9, - _ . /)");

function fmtLoc(l: any) {
  if (!l) return "–";
  return [l.name, l.hall, l.room, l.shelf, l.position].filter(Boolean).join(" › ");
}

type Suggestion = { type: ContainerMovementType; label: string; reason: string };

function suggestNextAction(c: any): { suggestion: Suggestion | null; blocked: string | null } {
  if (c.status === "entsorgt") return { suggestion: { type: "inventur", label: "Inventur erfassen", reason: "Gebinde entsorgt – keine Mengenbuchung möglich" }, blocked: "Dieses Gebinde wurde entsorgt. Nur Inventur erlaubt." };
  if (c.status === "gesperrt") return { suggestion: { type: "inventur", label: "Status prüfen", reason: "Gebinde gesperrt" }, blocked: "Gebinde gesperrt – bitte Status klären, bevor entnommen wird." };
  if (c.status === "leer" || Number(c.current_quantity) <= 0) return { suggestion: { type: "eingang", label: "Wareneingang buchen", reason: "Gebinde ist leer" }, blocked: null };
  if (c.status === "reserviert") return { suggestion: { type: "freigabe_reservierung", label: "Reservierung freigeben", reason: "Gebinde ist reserviert" }, blocked: null };
  return { suggestion: { type: "verbrauch", label: "Verbrauch / Entnahme buchen", reason: "Gebinde verfügbar" }, blocked: null };
}

const STATUS_LABEL: Record<string, string> = {
  verfuegbar: "Verfügbar", reserviert: "Reserviert", in_verwendung: "In Verwendung",
  leer: "Leer", gesperrt: "Gesperrt", entsorgt: "Entsorgt",
};
const KIND_LABEL: Record<string, string> = {
  fass: "Fass", kanister: "Kanister", sack: "Sack", big_bag: "Big Bag",
  ibc: "IBC", tank: "Tank", flasche: "Flasche", sonstige: "Sonstige",
};

interface RecentScan { code: string; ok: boolean; label: string; at: number; containerId?: string }

export default function ContainerScanPage() {
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [container, setContainer] = useState<any | null>(null);
  const [material, setMaterial] = useState<any | null>(null);
  const [error, setError] = useState<{ kind: "validation" | "not_found" | "lookup_error"; code: string; message: string } | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [defaultAction, setDefaultAction] = useState<ContainerMovementType>("verbrauch");
  const [recent, setRecent] = useState<RecentScan[]>([]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const pushRecent = (entry: RecentScan) => {
    setRecent((prev) => [entry, ...prev.filter((r) => r.code !== entry.code)].slice(0, 8));
  };

  const lookup = async (raw: string) => {
    const v = barcodeSchema.safeParse(raw);
    if (!v.success) {
      const msg = v.error.issues[0].message;
      setError({ kind: "validation", code: raw, message: msg });
      setContainer(null); setMaterial(null);
      toast.error(msg);
      return;
    }
    const code = v.data;
    setLoading(true);
    setError(null);
    try {
      const c = await api.rawMaterialContainers.getByBarcode(code);
      if (!c) {
        setContainer(null); setMaterial(null);
        setError({ kind: "not_found", code, message: `Kein Gebinde mit Code "${code}" gefunden.` });
        pushRecent({ code, ok: false, label: "Unbekannt", at: Date.now() });
        toast.error("Unbekannter Barcode");
        return;
      }
      setContainer(c);
      try {
        const mat = await api.rawMaterials.get(c.raw_material_id);
        setMaterial(mat);
      } catch { setMaterial(null); }
      pushRecent({ code, ok: true, label: c.container_code, at: Date.now(), containerId: c.id });
      toast.success(`Gebinde ${c.container_code} gefunden`);
    } catch (e: any) {
      const msg = String(e?.message || e);
      setError({ kind: "lookup_error", code, message: msg });
      toast.error("Fehler bei der Suche", { description: msg });
    } finally {
      setLoading(false);
      setScanValue("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleReset = () => {
    setContainer(null); setMaterial(null); setError(null); setScanValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) { setScanValue(code); lookup(code); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sug = container ? suggestNextAction(container) : { suggestion: null, blocked: null };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/rohstoffe"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><ScanLine className="h-6 w-6 text-primary" />Gebinde scannen</h1>
          <p className="text-sm text-muted-foreground">Barcode oder QR-Code scannen bzw. Gebinde-ID eingeben — die nächste Aktion wird automatisch vorgeschlagen.</p>
        </div>
        {(container || error) && (
          <Button variant="outline" size="sm" onClick={handleReset}><X className="h-4 w-4 mr-1" />Neuer Scan</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={(e) => { e.preventDefault(); lookup(scanValue); }} className="flex gap-2">
            <Input
              ref={inputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="Barcode / QR / Gebinde-ID (z.B. GEB-ET250001-001)"
              className="font-mono text-lg h-12"
              maxLength={100}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" disabled={loading || !scanValue.trim()} className="h-12">
              {loading ? "Suche..." : "Suchen"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            USB-Barcode-Scanner als Tastatur-Emulator funktionieren direkt. Erlaubte Zeichen: A–Z, 0–9, - _ . /
          </p>
        </CardContent>
      </Card>

      {/* Fehler-Anzeige mit klaren Aktionen */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {error.kind === "validation" && "Ungültiger Barcode"}
            {error.kind === "not_found" && "Unbekannter Barcode"}
            {error.kind === "lookup_error" && "Fehler bei der Suche"}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <div>
              <span className="font-mono">{error.code}</span> – {error.message}
            </div>
            {error.kind === "not_found" && (
              <div className="text-sm">
                Mögliche Ursachen: Etikett gehört zu einem anderen System (z.B. Probe/Charge), Gebinde wurde noch nicht angelegt oder Barcode ist falsch gelesen.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setScanValue(error.code); setError(null); setTimeout(() => inputRef.current?.focus(), 50); }}>
                <RotateCcw className="h-4 w-4 mr-1" />Erneut versuchen
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset}>Eingabe leeren</Button>
              {error.kind === "not_found" && (
                <Link to="/rohstoffe"><Button size="sm" variant="outline">Zur Rohstoffliste</Button></Link>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {container && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                  <Package className="h-5 w-5" />
                  {container.container_code}
                  <Badge variant="outline">{KIND_LABEL[container.kind] || container.kind}</Badge>
                  <Badge variant={container.status === "verfuegbar" ? "default" : container.status === "gesperrt" || container.status === "entsorgt" ? "destructive" : "secondary"}>
                    {STATUS_LABEL[container.status] || container.status}
                  </Badge>
                </CardTitle>
                <Link to={`/rohstoffe/${container.raw_material_id}`}>
                  <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4 mr-1" />Rohstoff öffnen</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Rohstoff</div>
                  <div className="font-medium flex items-center gap-2">
                    {material?.material_name || container.raw_materials?.material_name || "–"}
                    <GhsPictogramList hazardClasses={material?.hazard_categories} size="sm" />
                    <PsaSymbolList psaSymbols={(material as any)?.psa_symbols} size="sm" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {material?.material_number || ""}
                    {material?.cas_number ? ` · CAS ${material.cas_number}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Aktueller Bestand</div>
                  <div className="font-mono text-lg font-semibold">
                    {Number(container.current_quantity).toFixed(3)} {container.unit}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ursprünglich {Number(container.initial_quantity).toFixed(3)} {container.unit}
                    {container.reserved_quantity > 0 && ` · reserviert ${Number(container.reserved_quantity).toFixed(3)}`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Charge</div>
                  <div className="font-mono text-sm">{container.raw_material_batches?.batch_number || "–"}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><MapPin className="h-3 w-3" />Lagerort</div>
                  <div className="text-sm">{fmtLoc(container.storage_locations)}{container.location_note ? ` (${container.location_note})` : ""}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Barcode</div>
                  <div className="font-mono text-xs">{container.barcode || "–"}</div>
                </div>
              </div>

              {material?.is_hazardous && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="font-semibold flex items-center gap-2">
                    Gefahrstoff — Schutzmaßnahmen beachten
                    <GhsPictogramList hazardClasses={material.hazard_categories} size="sm" />
                    <PsaSymbolList psaSymbols={(material as any).psa_symbols} size="sm" />
                  </AlertDescription>
                </Alert>
              )}

              {sug.blocked && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Aktion eingeschränkt</AlertTitle>
                  <AlertDescription>{sug.blocked}</AlertDescription>
                </Alert>
              )}

              {sug.suggestion && (
                <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Vorgeschlagene Aktion</div>
                    <div className="font-medium">{sug.suggestion.label}</div>
                    <div className="text-xs text-muted-foreground">{sug.suggestion.reason}</div>
                  </div>
                  <Button onClick={() => { setDefaultAction(sug.suggestion!.type); setActionsOpen(true); }}>
                    {sug.suggestion.label}
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground self-center mr-1">Weitere Aktionen:</span>
                {([
                  ["verbrauch", "Verbrauch"],
                  ["eingang", "Eingang"],
                  ["umlagerung", "Umlagerung"],
                  ["inventur", "Inventur"],
                  ["korrektur_plus", "Korrektur +"],
                  ["korrektur_minus", "Korrektur −"],
                  ["entsorgung", "Entsorgung"],
                ] as [ContainerMovementType, string][]).map(([t, l]) => (
                  <Button key={t} variant="outline" size="sm" onClick={() => { setDefaultAction(t); setActionsOpen(true); }}>{l}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <ContainerActionsDialog
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            container={container}
            defaultMovementType={defaultAction}
          />
        </>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><HistoryIcon className="h-4 w-4" />Letzte Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <Button
                  key={r.code + r.at}
                  size="sm"
                  variant={r.ok ? "outline" : "ghost"}
                  className={r.ok ? "" : "text-destructive border border-dashed border-destructive/40"}
                  onClick={() => lookup(r.code)}
                  title={r.ok ? "Erneut laden" : "Erneut versuchen"}
                >
                  <span className="font-mono text-xs">{r.code}</span>
                  {r.ok && <span className="ml-2 text-xs text-muted-foreground">{r.label}</span>}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setRecent([])} className="text-muted-foreground">
                <X className="h-3 w-3 mr-1" />Liste leeren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

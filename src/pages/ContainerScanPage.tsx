import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ScanLine, ArrowLeft, Package, MapPin, ExternalLink, AlertTriangle } from "lucide-react";
import { ContainerActionsDialog } from "@/components/ContainerActionsDialog";
import type { ContainerMovementType } from "@/lib/api/containerMovements";
import { GhsPictogramList } from "@/components/GhsPictogram";

function fmtLoc(l: any) {
  if (!l) return "–";
  return [l.name, l.hall, l.room, l.shelf, l.position].filter(Boolean).join(" › ");
}

function suggestNextAction(c: any): { type: ContainerMovementType; label: string; reason: string } {
  if (c.status === "leer") return { type: "eingang", label: "Wareneingang buchen", reason: "Gebinde ist leer" };
  if (c.status === "entsorgt") return { type: "inventur", label: "Inventur erfassen", reason: "Gebinde wurde entsorgt" };
  if (c.status === "gesperrt") return { type: "inventur", label: "Status prüfen", reason: "Gebinde ist gesperrt" };
  if (c.status === "reserviert") return { type: "freigabe_reservierung", label: "Reservierung freigeben", reason: "Gebinde ist reserviert" };
  if (Number(c.current_quantity) <= 0) return { type: "eingang", label: "Wareneingang buchen", reason: "Bestand 0" };
  return { type: "verbrauch", label: "Verbrauch / Entnahme buchen", reason: "Gebinde verfügbar" };
}

const STATUS_LABEL: Record<string, string> = {
  verfuegbar: "Verfügbar", reserviert: "Reserviert", in_verwendung: "In Verwendung",
  leer: "Leer", gesperrt: "Gesperrt", entsorgt: "Entsorgt",
};
const KIND_LABEL: Record<string, string> = {
  fass: "Fass", kanister: "Kanister", sack: "Sack", big_bag: "Big Bag",
  ibc: "IBC", tank: "Tank", flasche: "Flasche", sonstige: "Sonstige",
};

export default function ContainerScanPage() {
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [container, setContainer] = useState<any | null>(null);
  const [material, setMaterial] = useState<any | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [defaultAction, setDefaultAction] = useState<ContainerMovementType>("verbrauch");

  useEffect(() => { inputRef.current?.focus(); }, []);

  const lookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setNotFound(null);
    try {
      const c = await api.rawMaterialContainers.getByBarcode(trimmed);
      if (!c) {
        setContainer(null); setMaterial(null);
        setNotFound(trimmed);
        return;
      }
      setContainer(c);
      // Materialdaten laden (für Gefahrenhinweise/Einheit)
      try {
        const mat = await api.rawMaterials.get(c.raw_material_id);
        setMaterial(mat);
      } catch { setMaterial(null); }
      toast.success(`Gebinde ${c.container_code} gefunden`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      setScanValue("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Auto-scan via ?code= (z.B. von QR-Tag)
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) { setScanValue(code); lookup(code); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestion = container ? suggestNextAction(container) : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/rohstoffe"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><ScanLine className="h-6 w-6 text-primary" />Gebinde scannen</h1>
          <p className="text-sm text-muted-foreground">Barcode oder QR-Code scannen bzw. Gebinde-ID eingeben — die nächste Aktion wird automatisch vorgeschlagen.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => { e.preventDefault(); lookup(scanValue); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="Barcode / QR / Gebinde-ID (z.B. GEB-ET250001-001)"
              className="font-mono text-lg h-12"
              autoFocus
            />
            <Button type="submit" disabled={loading || !scanValue.trim()} className="h-12">
              {loading ? "Suche..." : "Suchen"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            Tipp: USB-Barcode-Scanner als Tastatur-Emulator funktionieren direkt. Eingabe wird automatisch nach jedem Scan zurückgesetzt.
          </p>
        </CardContent>
      </Card>

      {notFound && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Kein Gebinde mit Code <span className="font-mono">{notFound}</span> gefunden.</AlertDescription>
        </Alert>
      )}

      {container && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {container.container_code}
                  <Badge variant="outline">{KIND_LABEL[container.kind] || container.kind}</Badge>
                  <Badge variant={container.status === "verfuegbar" ? "default" : "secondary"}>
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
                  </AlertDescription>
                </Alert>
              )}

              {suggestion && (
                <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Vorgeschlagene Aktion</div>
                    <div className="font-medium">{suggestion.label}</div>
                    <div className="text-xs text-muted-foreground">{suggestion.reason}</div>
                  </div>
                  <Button onClick={() => { setDefaultAction(suggestion.type); setActionsOpen(true); }}>
                    {suggestion.label}
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
    </div>
  );
}

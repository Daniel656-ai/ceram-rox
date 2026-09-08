import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRawMaterials, useStorageLocations, useAddRawMaterial, useAddBatch, useAddMovement, useAddContainer, useAddBatchToContainer, useFindBatch } from "@/hooks/useRawMaterials";
import { useUpdateRawMaterial } from "@/hooks/useRawMaterials";
import { useUsers } from "@/hooks/useUsers";
import { normalizeQuantity, parseQuantity, formatQuantity } from "@/lib/formatQuantity";

type Mode = "update" | "skip";

interface ParsedRow {
  mrs?: string;
  rk_code?: string;
  name?: string;
  other_designation?: string;
  quantity?: number;
  lot?: string;
  supplier?: string;
  manufacturer?: string;
  delivery_date?: string;
  location?: string;
  cas?: string;
  responsible?: string;
  __raw: Record<string, any>;
}

const COLUMN_ALIASES: Record<keyof Omit<ParsedRow, "__raw">, string[]> = {
  mrs: ["mrs", "mrs-nr", "mrs nr", "mrsnummer", "mrs-nummer"],
  rk_code: ["rk-code", "rk code", "rk", "rkcode", "rk-nr"],
  name: ["name", "produktname", "rohstoff", "bezeichnung", "rohstoffname", "material"],
  other_designation: ["sonstige bezeichnung", "sonstigebezeichnung", "alternative", "zusatzbezeichnung"],
  quantity: ["lagermenge", "lagermenge kg/l", "menge", "bestand", "liefermenge", "lagermenge kg", "menge kg"],
  lot: ["lot-nummer", "lot nummer", "lot", "lotnummer", "lot, bigbag, lieferung", "charge", "chargennummer", "lot-nr"],
  supplier: ["lieferant", "hersteller/lieferant", "hersteller / lieferant", "lieferant/hersteller"],
  manufacturer: ["hersteller"],
  delivery_date: ["lieferdatum", "datum", "wareneingang", "wareneingangsdatum", "we-datum", "we datum", "eingangsdatum"],
  location: ["lagerort", "ort", "lager", "lagerplatz"],
  cas: ["cas-nr", "cas nr", "casnummer", "cas", "cas-nummer"],
  responsible: ["verantwortlicher", "verantwortlich", "verantw."],
};

/** Spaltenüberschrift normalisieren: Kleinschreibung, Leerraum, Einheiten in Klammern entfernen. */
function normalizeKey(k: string) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ") // "Lagermenge (kg)" → "lagermenge"
    .replace(/\s+/g, " ")
    .trim();
}

function mapHeader(header: string): keyof Omit<ParsedRow, "__raw"> | null {
  const n = normalizeKey(header);
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(n)) return field as any;
  }
  return null;
}

function parseExcelDate(v: any): string | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd.mm.yyyy
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

/**
 * Liefermenge: Dezimalpunkt oder -komma korrekt interpretieren und auf
 * max. 3 Nachkommastellen runden (gilt ausdrücklich nur für die Liefermenge).
 */
function parseNumber(v: any): number | undefined {
  const n = normalizeQuantity(parseQuantity(v));
  return n === null ? undefined : n;
}

export function ImportRawMaterialsDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mode, setMode] = useState<Mode>("skip");
  const [fileName, setFileName] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<{ imported: number; updated: number; skipped: number; errors: { row: number; name?: string; message: string }[] } | null>(null);

  const { data: materials } = useRawMaterials();
  const { data: locations } = useStorageLocations();
  const { data: users } = useUsers();
  const addMaterial = useAddRawMaterial();
  const updateMaterial = useUpdateRawMaterial();
  const addBatch = useAddBatch();
  const findBatch = useFindBatch();
  const addContainer = useAddContainer();
  const addBatchToContainer = useAddBatchToContainer();
  const addMovement = useAddMovement();

  const reset = () => {
    setRows([]);
    setFileName("");
    setReport(null);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setReport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
      if (json.length === 0) {
        toast.error("Excel-Datei enthält keine Daten");
        return;
      }
      const headers = Object.keys(json[0]);
      const headerMap: Record<string, keyof Omit<ParsedRow, "__raw">> = {};
      for (const h of headers) {
        const f = mapHeader(h);
        if (f) headerMap[h] = f;
      }
      const parsed: ParsedRow[] = json.map((r) => {
        const p: ParsedRow = { __raw: r };
        for (const [h, field] of Object.entries(headerMap)) {
          const v = r[h];
          if (field === "quantity") p.quantity = parseNumber(v);
          else if (field === "delivery_date") p.delivery_date = parseExcelDate(v);
          else (p as any)[field] = v === "" || v == null ? undefined : String(v).trim();
        }
        return p;
      });
      setRows(parsed.filter((p) => p.name));
    } catch (e: any) {
      toast.error("Fehler beim Lesen der Datei", { description: e.message });
    }
  };

  const matchLocationId = (name?: string): string | undefined => {
    if (!name || !locations) return undefined;
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const n = norm(name);
    const parts = (l: any) => [l.hall, l.room, l.shelf, l.position].filter(Boolean).map(String);
    const loc =
      locations.find((l: any) => norm(l.name || "") === n || norm(parts(l).join(" › ")) === n) ||
      locations.find((l: any) => norm(parts(l).join(" ")) === n || norm(parts(l).join(" / ")) === n) ||
      // Nur Halle angegeben und eindeutig zuordenbar
      (() => {
        const hits = locations.filter((l: any) => parts(l).length === 1 && norm(String(l.hall || "")) === n);
        return hits.length === 1 ? hits[0] : undefined;
      })();
    return loc?.id;
  };

  const matchUserId = (label?: string): string | undefined => {
    if (!label || !users) return undefined;
    const n = label.toLowerCase().trim();
    const u = (users as any[]).find(
      (u) =>
        (u.short_code || "").toLowerCase() === n ||
        `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase().trim() === n ||
        (u.email || "").toLowerCase() === n
    );
    return u?.user_id;
  };

  const findExisting = (name: string) =>
    materials?.find((m) => m.material_name.toLowerCase().trim() === name.toLowerCase().trim());

  const runImport = async () => {
    setRunning(true);
    const r = { imported: 0, updated: 0, skipped: 0, errors: [] as { row: number; name?: string; message: string }[] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name) {
          r.errors.push({ row: i + 2, message: "Name fehlt" });
          continue;
        }
        const existing = findExisting(row.name);
        const locationId = matchLocationId(row.location);
        const responsibleId = matchUserId(row.responsible);

        if (existing && mode === "skip") {
          r.skipped++;
          continue;
        }

        let materialId: string;
        let materialLocationId: string | null;
        if (existing) {
          await updateMaterial.mutateAsync({
            id: existing.id,
            material_number: row.rk_code ?? undefined,
            other_designation: row.other_designation ?? undefined,
            cas_number: row.cas ?? undefined,
            mrs_number: row.mrs ?? undefined,
            supplier: row.supplier ?? undefined,
            manufacturer: row.manufacturer ?? undefined,
            default_location_id: locationId ?? undefined,
            responsible_user_id: responsibleId ?? undefined,
          });
          materialId = existing.id;
          materialLocationId = locationId ?? existing.default_location_id ?? null;
          r.updated++;
        } else {
          const created: any = await addMaterial.mutateAsync({
            material_name: row.name,
            material_number: row.rk_code || null,
            other_designation: row.other_designation || null,
            cas_number: row.cas || null,
            mrs_number: row.mrs || null,
            supplier: row.supplier || undefined,
            manufacturer: row.manufacturer || null,
            unit: "kg",
            default_location_id: locationId || undefined,
            responsible_user_id: responsibleId || null,
          });
          materialId = created.id;
          materialLocationId = locationId ?? null;
          r.imported++;
        }

        // Liefermenge ist bereits beim Einlesen auf max. 3 Nachkommastellen normalisiert.
        const qty = row.quantity && row.quantity > 0 ? row.quantity : 0;

        if (row.lot) {
          // Dieselbe Datenstruktur wie „LOT anlegen“ in der Detailansicht:
          // LOT (mit Lieferant/Wareneingang/Liefermenge) → Gebinde am Lagerort → Wareneingang verknüpft mit LOT.
          // Bestehende LOT desselben Rohstoffs wird wiederverwendet (keine Duplikate).
          let batch: any = await findBatch.mutateAsync({ raw_material_id: materialId, batch_number: row.lot });
          const batchIsNew = !batch;
          if (!batch) {
            batch = await addBatch.mutateAsync({
              raw_material_id: materialId,
              batch_number: row.lot,
              delivery_date: row.delivery_date,
              goods_receipt_date: row.delivery_date ?? null,
              delivery_quantity: qty || undefined,
              supplier: row.supplier,
            });
          }

          if (qty > 0 && batchIsNew) {
            const unit = (existing as any)?.unit || "kg";
            const container: any = await addContainer.mutateAsync({
              raw_material_id: materialId,
              batch_id: batch.id,
              container_code: null,
              kind: "big_bag",
              initial_quantity: qty,
              current_quantity: 0, // wird durch Positions-Sync gesetzt
              unit,
              status: "verfuegbar",
              location_id: materialLocationId,
            });
            await addBatchToContainer.mutateAsync({
              raw_material_id: materialId,
              container_id: container.id,
              batch_id: batch.id,
              quantity: qty,
              movement_date: row.delivery_date,
              comment: `Import – Wareneingang LOT ${row.lot}`,
            });
          }
        } else if (qty > 0) {
          // Ohne LOT-Nummer: Bestand als einfacher Wareneingang (bisheriges Verhalten).
          await addMovement.mutateAsync({
            raw_material_id: materialId,
            movement_type: "eingang",
            quantity: qty,
            movement_date: row.delivery_date,
            supplier: row.supplier,
            comment: "Import",
          });
        }
      } catch (e: any) {
        r.errors.push({ row: i + 2, name: row.name, message: e?.message || "Unbekannter Fehler" });
      }
    }
    setReport(r);
    setRunning(false);
    toast.success(`Import abgeschlossen: ${r.imported} neu, ${r.updated} aktualisiert, ${r.skipped} übersprungen, ${r.errors.length} Fehler`);
  };

  const preview = useMemo(() => rows.slice(0, 50), [rows]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1" />Excel-Import</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rohstoffe aus Excel importieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              className="max-w-md"
            />
            {fileName && <Badge variant="secondary"><FileSpreadsheet className="h-3 w-3 mr-1" />{fileName} – {rows.length} Zeilen</Badge>}
          </div>

          <div className="text-xs text-muted-foreground">
            Erwartete Spalten: MRS, RK-Code, Name, Sonstige Bezeichnung, Lagermenge (max. 3 Nachkommastellen), Lot-Nummer, Lieferant, Hersteller, Lieferdatum/Wareneingang, Lagerort, CAS-Nr, Verantwortlicher. Pro LOT wird wie beim manuellen Anlegen ein Gebinde am Lagerort mit verknüpftem Wareneingang erzeugt.
          </div>

          {rows.length > 0 && (
            <>
              <div>
                <Label>Vorgehen bei vorhandenen Rohstoffen (Name-Match)</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex gap-6 mt-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="skip" id="m-skip" /><Label htmlFor="m-skip" className="font-normal">Überspringen</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="update" id="m-update" /><Label htmlFor="m-update" className="font-normal">Stammdaten aktualisieren + Bestand zubuchen</Label></div>
                </RadioGroup>
              </div>

              <div className="border rounded-md overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>RK-Code</TableHead>
                      <TableHead>MRS</TableHead>
                      <TableHead>CAS</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead className="text-right">Menge</TableHead>
                      <TableHead>Lieferant</TableHead>
                      <TableHead>Lieferdatum</TableHead>
                      <TableHead>Lagerort</TableHead>
                      <TableHead>Verantw.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => {
                      const exists = r.name && findExisting(r.name);
                      const locOk = !r.location || !!matchLocationId(r.location);
                      const userOk = !r.responsible || !!matchUserId(r.responsible);
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 2}</TableCell>
                          <TableCell className="font-medium text-xs">{r.name || <span className="text-destructive">fehlt</span>}</TableCell>
                          <TableCell className="font-mono text-xs">{r.rk_code || "–"}</TableCell>
                          <TableCell className="text-xs">{r.mrs || "–"}</TableCell>
                          <TableCell className="text-xs">{r.cas || "–"}</TableCell>
                          <TableCell className="text-xs">{r.lot || "–"}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{r.quantity != null ? formatQuantity(r.quantity) : "–"}</TableCell>
                          <TableCell className="text-xs">{r.supplier || "–"}</TableCell>
                          <TableCell className="text-xs">{r.delivery_date || "–"}</TableCell>
                          <TableCell className="text-xs">{r.location || "–"} {!locOk && <Badge variant="outline" className="ml-1 text-[10px]">nicht gefunden</Badge>}</TableCell>
                          <TableCell className="text-xs">{r.responsible || "–"} {!userOk && <Badge variant="outline" className="ml-1 text-[10px]">nicht gefunden</Badge>}</TableCell>
                          <TableCell>{exists ? <Badge variant="secondary">vorhanden</Badge> : <Badge>neu</Badge>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {rows.length > preview.length && (
                  <div className="p-2 text-center text-xs text-muted-foreground">… {rows.length - preview.length} weitere Zeilen</div>
                )}
              </div>
            </>
          )}

          {report && (
            <div className="rounded-md border p-4 space-y-2 bg-muted/30">
              <div className="font-semibold">Import-Bericht</div>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div><div className="text-2xl font-bold text-primary">{report.imported}</div><div className="text-xs text-muted-foreground">Neu angelegt</div></div>
                <div><div className="text-2xl font-bold">{report.updated}</div><div className="text-xs text-muted-foreground">Aktualisiert</div></div>
                <div><div className="text-2xl font-bold">{report.skipped}</div><div className="text-xs text-muted-foreground">Übersprungen</div></div>
                <div><div className="text-2xl font-bold text-destructive">{report.errors.length}</div><div className="text-xs text-muted-foreground">Fehler</div></div>
              </div>
              {report.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto text-xs space-y-1 mt-2">
                  {report.errors.map((e, i) => (
                    <div key={i} className="text-destructive">Zeile {e.row} {e.name ? `(${e.name})` : ""}: {e.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Schließen</Button>
          <Button onClick={runImport} disabled={rows.length === 0 || running}>
            {running && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Import starten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

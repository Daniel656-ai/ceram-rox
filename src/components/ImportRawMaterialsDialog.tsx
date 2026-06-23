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
import { useRawMaterials, useStorageLocations, useAddRawMaterial, useAddBatch, useAddMovement } from "@/hooks/useRawMaterials";
import { useUpdateRawMaterial } from "@/hooks/useRawMaterials";
import { useUsers } from "@/hooks/useUsers";

type Mode = "update" | "skip";

interface ParsedRow {
  mrs?: string;
  rk_code?: string;
  name?: string;
  other_designation?: string;
  quantity?: number;
  lot?: string;
  supplier?: string;
  delivery_date?: string;
  location?: string;
  cas?: string;
  responsible?: string;
  __raw: Record<string, any>;
}

const COLUMN_ALIASES: Record<keyof Omit<ParsedRow, "__raw">, string[]> = {
  mrs: ["mrs", "mrs-nr", "mrs nr", "mrsnummer"],
  rk_code: ["rk-code", "rk code", "rk", "rkcode"],
  name: ["name", "produktname", "rohstoff", "bezeichnung"],
  other_designation: ["sonstige bezeichnung", "sonstigebezeichnung", "alternative"],
  quantity: ["lagermenge", "lagermenge kg/l", "menge", "bestand"],
  lot: ["lot-nummer", "lot nummer", "lot", "lotnummer", "lot, bigbag, lieferung"],
  supplier: ["lieferant", "hersteller/lieferant", "hersteller"],
  delivery_date: ["lieferdatum", "datum"],
  location: ["lagerort", "ort", "lager"],
  cas: ["cas-nr", "cas nr", "casnummer", "cas"],
  responsible: ["verantwortlicher", "verantwortlich"],
};

function normalizeKey(k: string) {
  return String(k || "").trim().toLowerCase().replace(/\s+/g, " ");
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
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd.mm.yyyy
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

function parseNumber(v: any): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
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
    const n = name.toLowerCase().trim();
    const loc = locations.find(
      (l: any) =>
        (l.name || "").toLowerCase() === n ||
        [l.hall, l.room, l.shelf, l.position].filter(Boolean).join(" › ").toLowerCase() === n
    );
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
        if (existing) {
          await updateMaterial.mutateAsync({
            id: existing.id,
            material_number: row.rk_code ?? undefined,
            other_designation: row.other_designation ?? undefined,
            cas_number: row.cas ?? undefined,
            mrs_number: row.mrs ?? undefined,
            supplier: row.supplier ?? undefined,
            default_location_id: locationId ?? undefined,
            responsible_user_id: responsibleId ?? undefined,
          });
          materialId = existing.id;
          r.updated++;
        } else {
          const created: any = await addMaterial.mutateAsync({
            material_name: row.name,
            material_number: row.rk_code || null,
            other_designation: row.other_designation || null,
            cas_number: row.cas || null,
            mrs_number: row.mrs || null,
            supplier: row.supplier || undefined,
            unit: "kg",
            default_location_id: locationId || undefined,
            responsible_user_id: responsibleId || null,
          });
          materialId = created.id;
          r.imported++;
        }

        // Optional batch with lot info
        if (row.lot) {
          try {
            await addBatch.mutateAsync({
              raw_material_id: materialId,
              batch_number: row.lot,
              delivery_date: row.delivery_date,
              delivery_quantity: row.quantity,
              supplier: row.supplier,
            });
          } catch {
            /* batch may already exist – ignore */
          }
        }

        // Initial stock as inventory movement
        if (row.quantity && row.quantity > 0) {
          try {
            await addMovement.mutateAsync({
              raw_material_id: materialId,
              movement_type: "eingang",
              quantity: row.quantity,
              movement_date: row.delivery_date,
              supplier: row.supplier,
              comment: row.lot ? `Import – Lot ${row.lot}` : "Import",
            });
          } catch (e: any) {
            // don't fail the row for movement issues
            console.warn("Movement failed for", row.name, e?.message);
          }
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
            Erwartete Spalten: MRS, RK-Code, Name, Sonstige Bezeichnung, Lagermenge, Lot-Nummer, Lieferant, Lieferdatum, Lagerort, CAS-Nr, Verantwortlicher
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
                          <TableCell className="text-right font-mono text-xs">{r.quantity ?? "–"}</TableCell>
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

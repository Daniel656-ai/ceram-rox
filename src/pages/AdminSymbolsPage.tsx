import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCustomSymbols,
  useCreateCustomSymbol,
  useUpdateCustomSymbol,
  useDeleteCustomSymbol,
} from "@/hooks/useCustomSymbols";
import type { CustomSymbol, SymbolCategory } from "@/lib/api/customSymbols";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Pencil, Trash2, Upload, Plus, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { GHS_SYMBOLS, PSA_SYMBOLS } from "@/lib/labels/symbols";

const MAX_BYTES = 512 * 1024; // 512 KB (Bilddaten werden als Data-URL in der DB gespeichert)
const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "symbol";
}

interface EditState {
  open: boolean;
  symbol: CustomSymbol | null;
  category: SymbolCategory;
  file: File | null;
  preview: string | null;
  code: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

const emptyEdit = (category: SymbolCategory): EditState => ({
  open: false,
  symbol: null,
  category,
  file: null,
  preview: null,
  code: "",
  name: "",
  description: "",
  sort_order: 0,
  is_active: true,
});

export default function AdminSymbolsPage() {
  const { user, role } = useAuth();
  const canEdit = role === "master";
  const { data: symbols = [], isLoading } = useCustomSymbols();
  const createMut = useCreateCustomSymbol();
  const updateMut = useUpdateCustomSymbol();
  const deleteMut = useDeleteCustomSymbol();

  const [tab, setTab] = useState<SymbolCategory>("ghs");
  const [edit, setEdit] = useState<EditState>(emptyEdit("ghs"));
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ghsBuiltin = GHS_SYMBOLS.map((s) => s.key);
  const psaBuiltin = PSA_SYMBOLS.map((s) => s.key);

  const list = (cat: SymbolCategory) => symbols.filter((s) => s.category === cat);

  const openCreate = (cat: SymbolCategory) => {
    setEdit({ ...emptyEdit(cat), open: true });
  };

  const openEdit = (sym: CustomSymbol) => {
    setEdit({
      open: true,
      symbol: sym,
      category: sym.category,
      file: null,
      preview: sym.image_data_url,
      code: sym.code,
      name: sym.name,
      description: sym.description ?? "",
      sort_order: sym.sort_order,
      is_active: sym.is_active,
    });
  };

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Ungültiges Format", { description: "Erlaubt: PNG, JPG, SVG, WebP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Datei zu groß", { description: "Maximale Größe: 512 KB." });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setEdit((e) => ({
      ...e,
      file,
      preview: dataUrl,
      code: e.code || slugify(file.name),
      name: e.name || file.name.replace(/\.[a-z0-9]+$/i, ""),
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!edit.name.trim() || !edit.code.trim()) {
      toast.error("Name und Code sind erforderlich");
      return;
    }
    if (!edit.symbol && !edit.preview) {
      toast.error("Bitte ein Bild auswählen");
      return;
    }
    try {
      if (edit.symbol) {
        const patch: any = {
          code: edit.code.trim(),
          name: edit.name.trim(),
          description: edit.description.trim() || null,
          sort_order: edit.sort_order,
          is_active: edit.is_active,
        };
        if (edit.file) {
          patch.image_data_url = edit.preview!;
          patch.mime_type = edit.file.type;
          patch.file_size = edit.file.size;
        }
        await updateMut.mutateAsync({ id: edit.symbol.id, patch, userId: user.id });
        toast.success("Symbol aktualisiert");
      } else {
        await createMut.mutateAsync({
          input: {
            category: edit.category,
            code: edit.code.trim(),
            name: edit.name.trim(),
            description: edit.description.trim() || null,
            image_data_url: edit.preview!,
            mime_type: edit.file!.type,
            file_size: edit.file!.size,
            sort_order: edit.sort_order,
            is_active: edit.is_active,
          },
          userId: user.id,
        });
        toast.success("Symbol angelegt");
      }
      setEdit(emptyEdit(edit.category));
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Code existiert bereits in dieser Kategorie");
      } else {
        toast.error("Speichern fehlgeschlagen", { description: msg });
      }
    }
  };

  const handleDelete = async (sym: CustomSymbol) => {
    if (!confirm(`Symbol "${sym.name}" wirklich löschen?`)) return;
    try {
      await deleteMut.mutateAsync(sym.id);
      toast.success("Symbol gelöscht");
    } catch (err: any) {
      toast.error("Löschen fehlgeschlagen", { description: err.message });
    }
  };

  const renderGrid = (cat: SymbolCategory) => {
    const items = list(cat);
    const builtin = cat === "ghs" ? ghsBuiltin : psaBuiltin;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {items.length} eigene Symbole · {builtin.length} systemseitig vorhanden ({builtin.join(", ")})
          </p>
          <Button onClick={() => openCreate(cat)} disabled={!canEdit}>
            <Plus className="h-4 w-4 mr-2" />Symbol hinzufügen
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="border rounded-md p-8 text-center text-sm text-muted-foreground">
            Noch keine eigenen Symbole hochgeladen.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((s) => (
              <Card key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="aspect-square bg-muted/40 rounded flex items-center justify-center p-2">
                    <img src={s.image_data_url} alt={s.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium truncate" title={s.name}>{s.name}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{s.code}</Badge>
                      {!s.is_active && <Badge variant="secondary" className="text-[10px]">inaktiv</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="flex-1 h-7" onClick={() => openEdit(s)} disabled={!canEdit}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 h-7 text-destructive" onClick={() => handleDelete(s)} disabled={!canEdit}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Lädt...</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Symbole verwalten</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verwaltung individueller Gefahrgut- (GHS) und PSA-Symbole. Hochgeladene Symbole stehen
          automatisch in Formularen, Etiketten und Druckansichten zur Auswahl.
        </p>
      </div>

      {!canEdit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Nur Master-Benutzer können Symbole anlegen oder ändern.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Symbol-Bibliothek</CardTitle>
          <CardDescription>PNG, JPG, SVG oder WebP, max. 512&nbsp;KB pro Datei.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as SymbolCategory)}>
            <TabsList>
              <TabsTrigger value="ghs">Gefahrgutzeichen (GHS)</TabsTrigger>
              <TabsTrigger value="psa">PSA-Symbole</TabsTrigger>
            </TabsList>
            <TabsContent value="ghs" className="mt-4">{renderGrid("ghs")}</TabsContent>
            <TabsContent value="psa" className="mt-4">{renderGrid("psa")}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={edit.open} onOpenChange={(o) => !o && setEdit(emptyEdit(edit.category))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit.symbol ? "Symbol bearbeiten" : "Neues Symbol"}</DialogTitle>
            <DialogDescription>
              Kategorie: {edit.category === "ghs" ? "Gefahrgutzeichen (GHS)" : "PSA-Symbol"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-md p-4 cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[160px] ${dragOver ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
            >
              {edit.preview ? (
                <img src={edit.preview} alt="Vorschau" className="max-h-32 max-w-full object-contain" />
              ) : (
                <>
                  <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Datei hierher ziehen oder klicken</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, WebP · max. 512 KB</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            {edit.preview && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3 mr-2" />Anderes Bild wählen
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sym-code">Code *</Label>
                <Input id="sym-code" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="z. B. ghs10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sym-sort">Sortierung</Label>
                <Input id="sym-sort" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sym-name">Name *</Label>
              <Input id="sym-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="z. B. Heißes Material" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sym-desc">Beschreibung</Label>
              <Textarea id="sym-desc" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="sym-active" checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              <Label htmlFor="sym-active">Aktiv (zur Auswahl verfügbar)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(emptyEdit(edit.category))}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {edit.symbol ? "Speichern" : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

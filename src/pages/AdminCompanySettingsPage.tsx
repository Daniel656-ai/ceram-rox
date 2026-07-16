import { useState, useEffect } from "react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Image as ImageIcon, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { CompanyBrandingPreview } from "@/components/CompanyBrandingPreview";

const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AdminCompanySettingsPage() {
  const { user, role } = useAuth();
  const { data: settings, isLoading } = useCompanySettings();
  const updateMut = useUpdateCompanySettings();
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings) setName(settings.company_name ?? "");
  }, [settings]);

  const canEdit = role === "master";

  const handleLogoUpload = async (file: File) => {
    if (!user) return;
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error("Ungültiges Format", { description: "Erlaubt: PNG, JPG, SVG, WebP." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Datei zu groß", { description: "Maximale Größe: 1 MB." });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await updateMut.mutateAsync({
        patch: { logo_data_url: dataUrl, logo_mime: file.type },
        userId: user.id,
      });
      toast.success("Logo gespeichert");
    } catch (err: any) {
      toast.error("Speichern fehlgeschlagen", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!user) return;
    if (!confirm("Logo wirklich entfernen?")) return;
    try {
      await updateMut.mutateAsync({
        patch: { logo_data_url: null, logo_mime: null },
        userId: user.id,
      });
      toast.success("Logo entfernt");
    } catch (err: any) {
      toast.error("Entfernen fehlgeschlagen", { description: err.message });
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    try {
      await updateMut.mutateAsync({ patch: { company_name: name.trim() || null }, userId: user.id });
      toast.success("Gespeichert");
    } catch (err: any) {
      toast.error("Speichern fehlgeschlagen", { description: err.message });
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Lädt...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <style>{`@keyframes fade-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Firmeneinstellungen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Zentrale Verwaltung von Firmenname und Logo. Das Logo wird automatisch in allen
          Berichten, Etiketten, PDFs und Druckansichten verwendet.
        </p>
      </div>

      {!canEdit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Nur Master-Benutzer können diese Einstellungen ändern.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Firmenname</CardTitle>
          <CardDescription>Erscheint neben dem Logo in Berichten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="company-name">Name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              placeholder="z. B. Ceram GmbH"
            />
          </div>
          <Button onClick={handleSaveName} disabled={!canEdit || updateMut.isPending}>
            Speichern
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firmenlogo</CardTitle>
          <CardDescription>
            PNG, JPG, SVG oder WebP, max. 1&nbsp;MB. Für beste Qualität SVG oder hochauflösende
            PNG empfohlen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-md p-6 bg-muted/30 flex items-center justify-center min-h-[160px]">
            {settings?.logo_data_url ? (
              <img
                src={settings.logo_data_url}
                alt="Firmenlogo"
                className="max-h-32 max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm">Kein Logo hinterlegt</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <label className={canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
              <input
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                disabled={!canEdit || uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = "";
                }}
              />
              <Button variant="default" asChild disabled={!canEdit || uploading}>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Lädt..." : settings?.logo_data_url ? "Logo ersetzen" : "Logo hochladen"}
                </span>
              </Button>
            </label>
            {settings?.logo_data_url && canEdit && (
              <Button variant="outline" onClick={handleLogoRemove} disabled={updateMut.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />Entfernen
              </Button>
            )}
          </div>
          {settings?.logo_updated_at && (
            <p className="text-xs text-muted-foreground">
              Zuletzt geändert: {new Date(settings.logo_updated_at).toLocaleString("de-DE")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Materialverfügbarkeit</CardTitle>
          <CardDescription>
            Verhalten, wenn beim Start eines Prozessschritts nicht ausreichend Rohstoffe (aus vorhandenen
            Gebinden / LOTs) verfügbar sind.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-md">
          <Label>Prüfmodus</Label>
          <Select
            value={settings?.raw_material_check_mode ?? "warn"}
            onValueChange={async (v) => {
              if (!user) return;
              try {
                await updateMut.mutateAsync({ patch: { raw_material_check_mode: v as any }, userId: user.id });
                toast.success("Gespeichert");
              } catch (err: any) {
                toast.error("Speichern fehlgeschlagen", { description: err.message });
              }
            }}
            disabled={!canEdit}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="warn">Hinweis anzeigen (empfohlen)</SelectItem>
              <SelectItem value="allow">Nur informieren – Auftrag trotzdem starten</SelectItem>
              <SelectItem value="block">Auftrag erst nach Materialverfügbarkeit freigeben</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <CompanyBrandingPreview />
    </div>
  );
}


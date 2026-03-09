import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncSetting, useUpsertSyncSetting } from "@/hooks/useSyncSettings";
import { Copy, RefreshCw, Calendar, Link2, Upload, ExternalLink } from "lucide-react";

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminSyncPage() {
  const { user } = useAuth();
  const upsert = useUpsertSyncSetting();

  // ICS Feed settings
  const { data: icsTokenSetting, isLoading: icsLoading } = useSyncSetting("ics_feed_token");
  const [icsToken, setIcsToken] = useState("");

  // Outlook settings
  const { data: outlookSetting } = useSyncSetting("outlook_sync");
  const [outlookEnabled, setOutlookEnabled] = useState(false);
  const [outlookDirection, setOutlookDirection] = useState<"export" | "import" | "bidirectional">("export");

  // DPW settings
  const { data: dpwSetting } = useSyncSetting("dpw_sync");
  const [dpwEnabled, setDpwEnabled] = useState(false);
  const [dpwDirection, setDpwDirection] = useState<"export" | "import" | "bidirectional">("import");
  const [dpwEndpoint, setDpwEndpoint] = useState("");
  const [dpwInterval, setDpwInterval] = useState("60");

  useEffect(() => {
    if (icsTokenSetting) {
      setIcsToken((icsTokenSetting.setting_value as any)?.token || "");
    }
  }, [icsTokenSetting]);

  useEffect(() => {
    if (outlookSetting) {
      const v = outlookSetting.setting_value as any;
      setOutlookEnabled(v?.enabled ?? false);
      setOutlookDirection(v?.direction ?? "export");
    }
  }, [outlookSetting]);

  useEffect(() => {
    if (dpwSetting) {
      const v = dpwSetting.setting_value as any;
      setDpwEnabled(v?.enabled ?? false);
      setDpwDirection(v?.direction ?? "import");
      setDpwEndpoint(v?.endpoint ?? "");
      setDpwInterval(v?.interval ?? "60");
    }
  }, [dpwSetting]);

  const generateIcsToken = async () => {
    const token = generateToken();
    await upsert.mutateAsync({ key: "ics_feed_token", value: { token }, userId: user!.id });
    setIcsToken(token);
    toast({ title: "ICS-Feed Token generiert" });
  };

  const icsFeedUrl = icsToken
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/absence-ics-feed?token=${icsToken}`
    : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "In Zwischenablage kopiert" });
  };

  const saveOutlookSettings = async () => {
    await upsert.mutateAsync({
      key: "outlook_sync",
      value: { enabled: outlookEnabled, direction: outlookDirection },
      userId: user!.id,
    });
    toast({ title: "Outlook-Einstellungen gespeichert" });
  };

  const saveDpwSettings = async () => {
    await upsert.mutateAsync({
      key: "dpw_sync",
      value: { enabled: dpwEnabled, direction: dpwDirection, endpoint: dpwEndpoint, interval: dpwInterval },
      userId: user!.id,
    });
    toast({ title: "DPW-Einstellungen gespeichert" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Synchronisation</h1>
        <p className="text-muted-foreground">
          Konfigurieren Sie die Synchronisation des Abwesenheitsplaners mit externen Systemen.
        </p>
      </div>

      {/* ICS Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">ICS-Kalender-Feed</CardTitle>
          </div>
          <CardDescription>
            Generieren Sie einen ICS-Feed-Link, den Sie in Outlook, Google Calendar oder jedem
            anderen Kalender-Client abonnieren können. Abwesenheiten werden automatisch als
            Kalendereinträge angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {icsToken ? (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Feed-URL (zum Abonnieren in Outlook)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={icsFeedUrl} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(icsFeedUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  In Outlook: Kalender → Kalender hinzufügen → Aus dem Internet abonnieren → URL einfügen
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={generateIcsToken}>
                <RefreshCw className="h-4 w-4 mr-1" /> Token neu generieren
              </Button>
            </>
          ) : (
            <Button onClick={generateIcsToken} disabled={icsLoading}>
              <Calendar className="h-4 w-4 mr-1" /> ICS-Feed aktivieren
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Outlook / Microsoft Graph */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Microsoft Outlook / Graph API</CardTitle>
            <Badge variant="secondary">Vorbereitet</Badge>
          </div>
          <CardDescription>
            Bidirektionale Synchronisation mit Microsoft 365 Kalender über die Graph API.
            Erfordert eine Azure App Registration mit den entsprechenden Berechtigungen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Outlook-Synchronisation aktivieren</Label>
            <Switch checked={outlookEnabled} onCheckedChange={setOutlookEnabled} />
          </div>
          {outlookEnabled && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Synchronisationsrichtung</Label>
                <Select value={outlookDirection} onValueChange={(v: any) => setOutlookDirection(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="export">Nur exportieren (→ Outlook)</SelectItem>
                    <SelectItem value="import">Nur importieren (← Outlook)</SelectItem>
                    <SelectItem value="bidirectional">Bidirektional (↔)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Einrichtung erforderlich:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Azure App Registration erstellen</li>
                  <li>API-Berechtigung <code className="text-xs bg-muted px-1 rounded">Calendars.ReadWrite</code> hinzufügen</li>
                  <li>Client ID und Client Secret hier hinterlegen</li>
                </ol>
              </div>
            </>
          )}
          <Button size="sm" onClick={saveOutlookSettings}>
            Einstellungen speichern
          </Button>
        </CardContent>
      </Card>

      {/* DPW System */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">DPW-System</CardTitle>
            <Badge variant="secondary">Vorbereitet</Badge>
          </div>
          <CardDescription>
            Synchronisation mit dem internen DPW-System. Unterstützt REST API oder CSV/Excel-Import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>DPW-Synchronisation aktivieren</Label>
            <Switch checked={dpwEnabled} onCheckedChange={setDpwEnabled} />
          </div>
          {dpwEnabled && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Synchronisationsrichtung</Label>
                <Select value={dpwDirection} onValueChange={(v: any) => setDpwDirection(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="export">Nur exportieren (→ DPW)</SelectItem>
                    <SelectItem value="import">Nur importieren (← DPW)</SelectItem>
                    <SelectItem value="bidirectional">Bidirektional (↔)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">API-Endpunkt (optional)</Label>
                <Input
                  value={dpwEndpoint}
                  onChange={(e) => setDpwEndpoint(e.target.value)}
                  placeholder="https://dpw.firma.de/api/absences"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Synchronisationsintervall (Minuten)</Label>
                <Select value={dpwInterval} onValueChange={setDpwInterval}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Alle 15 Minuten</SelectItem>
                    <SelectItem value="30">Alle 30 Minuten</SelectItem>
                    <SelectItem value="60">Stündlich</SelectItem>
                    <SelectItem value="360">Alle 6 Stunden</SelectItem>
                    <SelectItem value="1440">Täglich</SelectItem>
                    <SelectItem value="manual">Nur manuell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">CSV/Excel-Import</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Falls keine REST API verfügbar ist, können Abwesenheiten über CSV/Excel importiert werden.
                  Erwartete Spalten: Mitarbeiter-ID, Abwesenheitstyp, Startdatum, Enddatum, Kommentar
                </p>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1" /> CSV/Excel importieren
                </Button>
              </div>
            </>
          )}
          <Button size="sm" onClick={saveDpwSettings}>
            Einstellungen speichern
          </Button>
        </CardContent>
      </Card>

      {/* Conflict management info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Konfliktmanagement</CardTitle>
          <CardDescription>
            Bei Unterschieden zwischen den Systemen werden Konflikte automatisch erkannt und angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Wenn ein Eintrag in mehreren Systemen existiert, wird die Quelle als Badge angezeigt.</p>
            <p>• Bei Abweichungen (z.B. unterschiedliche Zeiträume) wird ein Konflikt-Hinweis eingeblendet.</p>
            <p>• Sie können dann wählen, welcher Eintrag übernommen werden soll.</p>
            <p>• Alle Synchronisationsaktionen werden im Audit-Log protokolliert.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["admin", "common"]);
  const { user } = useAuth();
  const upsert = useUpsertSyncSetting();

  const { data: icsTokenSetting, isLoading: icsLoading } = useSyncSetting("ics_feed_token");
  const [icsToken, setIcsToken] = useState("");

  const { data: outlookSetting } = useSyncSetting("outlook_sync");
  const [outlookEnabled, setOutlookEnabled] = useState(false);
  const [outlookDirection, setOutlookDirection] = useState<"export" | "import" | "bidirectional">("export");

  const { data: dpwSetting } = useSyncSetting("dpw_sync");
  const [dpwEnabled, setDpwEnabled] = useState(false);
  const [dpwDirection, setDpwDirection] = useState<"export" | "import" | "bidirectional">("import");
  const [dpwEndpoint, setDpwEndpoint] = useState("");
  const [dpwInterval, setDpwInterval] = useState("60");

  useEffect(() => { if (icsTokenSetting) setIcsToken((icsTokenSetting.setting_value as any)?.token || ""); }, [icsTokenSetting]);
  useEffect(() => { if (outlookSetting) { const v = outlookSetting.setting_value as any; setOutlookEnabled(v?.enabled ?? false); setOutlookDirection(v?.direction ?? "export"); } }, [outlookSetting]);
  useEffect(() => { if (dpwSetting) { const v = dpwSetting.setting_value as any; setDpwEnabled(v?.enabled ?? false); setDpwDirection(v?.direction ?? "import"); setDpwEndpoint(v?.endpoint ?? ""); setDpwInterval(v?.interval ?? "60"); } }, [dpwSetting]);

  const generateIcsToken = async () => {
    const token = generateToken();
    await upsert.mutateAsync({ key: "ics_feed_token", value: { token }, userId: user!.id });
    setIcsToken(token);
    toast({ title: t("admin:ics_generated") });
  };

  const icsFeedUrl = icsToken ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/absence-ics-feed?token=${icsToken}` : "";

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: t("admin:copied") }); };

  const saveOutlookSettings = async () => {
    await upsert.mutateAsync({ key: "outlook_sync", value: { enabled: outlookEnabled, direction: outlookDirection }, userId: user!.id });
    toast({ title: t("admin:outlook_saved") });
  };

  const saveDpwSettings = async () => {
    await upsert.mutateAsync({ key: "dpw_sync", value: { enabled: dpwEnabled, direction: dpwDirection, endpoint: dpwEndpoint, interval: dpwInterval }, userId: user!.id });
    toast({ title: t("admin:dpw_saved") });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin:sync_title")}</h1>
        <p className="text-muted-foreground">{t("admin:sync_subtitle")}</p>
      </div>

      {/* ICS Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t("admin:ics_title")}</CardTitle>
          </div>
          <CardDescription>{t("admin:ics_description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {icsToken ? (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin:ics_feed_url")}</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={icsFeedUrl} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(icsFeedUrl)}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t("admin:ics_outlook_hint")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={generateIcsToken}>
                <RefreshCw className="h-4 w-4 mr-1" /> {t("admin:ics_regenerate")}
              </Button>
            </>
          ) : (
            <Button onClick={generateIcsToken} disabled={icsLoading}>
              <Calendar className="h-4 w-4 mr-1" /> {t("admin:ics_activate")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Outlook */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t("admin:outlook_title")}</CardTitle>
            <Badge variant="secondary">{t("admin:outlook_prepared")}</Badge>
          </div>
          <CardDescription>{t("admin:outlook_description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t("admin:outlook_enable")}</Label>
            <Switch checked={outlookEnabled} onCheckedChange={setOutlookEnabled} />
          </div>
          {outlookEnabled && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin:outlook_direction")}</Label>
                <Select value={outlookDirection} onValueChange={(v: any) => setOutlookDirection(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="export">{t("admin:outlook_export")}</SelectItem>
                    <SelectItem value="import">{t("admin:outlook_import")}</SelectItem>
                    <SelectItem value="bidirectional">{t("admin:outlook_bidirectional")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">{t("admin:outlook_setup_title")}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t("admin:outlook_setup_1")}</li>
                  <li>{t("admin:outlook_setup_2")} <code className="text-xs bg-muted px-1 rounded">Calendars.ReadWrite</code></li>
                  <li>{t("admin:outlook_setup_3")}</li>
                </ol>
              </div>
            </>
          )}
          <Button size="sm" onClick={saveOutlookSettings}>{t("admin:save_settings")}</Button>
        </CardContent>
      </Card>

      {/* DPW */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t("admin:dpw_title")}</CardTitle>
            <Badge variant="secondary">{t("admin:outlook_prepared")}</Badge>
          </div>
          <CardDescription>{t("admin:dpw_description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t("admin:dpw_enable")}</Label>
            <Switch checked={dpwEnabled} onCheckedChange={setDpwEnabled} />
          </div>
          {dpwEnabled && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin:outlook_direction")}</Label>
                <Select value={dpwDirection} onValueChange={(v: any) => setDpwDirection(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="export">{t("admin:outlook_export")}</SelectItem>
                    <SelectItem value="import">{t("admin:outlook_import")}</SelectItem>
                    <SelectItem value="bidirectional">{t("admin:outlook_bidirectional")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin:dpw_endpoint")}</Label>
                <Input value={dpwEndpoint} onChange={(e) => setDpwEndpoint(e.target.value)} placeholder={t("admin:dpw_endpoint_placeholder")} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin:dpw_interval")}</Label>
                <Select value={dpwInterval} onValueChange={setDpwInterval}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">{t("admin:dpw_interval_15")}</SelectItem>
                    <SelectItem value="30">{t("admin:dpw_interval_30")}</SelectItem>
                    <SelectItem value="60">{t("admin:dpw_interval_60")}</SelectItem>
                    <SelectItem value="360">{t("admin:dpw_interval_360")}</SelectItem>
                    <SelectItem value="1440">{t("admin:dpw_interval_1440")}</SelectItem>
                    <SelectItem value="manual">{t("admin:dpw_interval_manual")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{t("admin:dpw_csv_title")}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t("admin:dpw_csv_description")}</p>
                <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> {t("admin:dpw_csv_import")}</Button>
              </div>
            </>
          )}
          <Button size="sm" onClick={saveDpwSettings}>{t("admin:save_settings")}</Button>
        </CardContent>
      </Card>

      {/* Conflict management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin:conflict_title")}</CardTitle>
          <CardDescription>{t("admin:conflict_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• {t("admin:conflict_info_1")}</p>
            <p>• {t("admin:conflict_info_2")}</p>
            <p>• {t("admin:conflict_info_3")}</p>
            <p>• {t("admin:conflict_info_4")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

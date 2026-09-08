import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";

// Local typed wrapper around the beta `supabase.auth.oauth` namespace so the
// consent flow doesn't rely on ambient typings for it.
type OAuthClient = { name?: string; client_name?: string };
type AuthzDetails = {
  client?: OAuthClient;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};
type OAuthResp<T> = { data: T | null; error: { message: string } | null };
const oauth = (supabase as any).auth.oauth as {
  getAuthorizationDetails: (id: string) => Promise<OAuthResp<AuthzDetails>>;
  approveAuthorization: (id: string) => Promise<OAuthResp<AuthzDetails>>;
  denyAuthorization: (id: string) => Promise<OAuthResp<AuthzDetails>>;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthzDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
            <FlaskConical className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">Ceram ROX</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Zugriff erlauben</CardTitle>
            <CardDescription>
              {details?.client
                ? `${details.client.name ?? details.client.client_name ?? "Eine Anwendung"} möchte in deinem Namen auf Ceram ROX zugreifen.`
                : "Autorisierungsanfrage prüfen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!error && !details && <p className="text-sm text-muted-foreground">Lade…</p>}
            {details && (
              <>
                <p className="text-sm text-muted-foreground">
                  Die Anwendung kann anschließend Ceram-ROX-Daten in deinem Namen lesen (RLS gilt weiterhin).
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => decide(true)} disabled={busy} className="flex-1">
                    Erlauben
                  </Button>
                  <Button onClick={() => decide(false)} disabled={busy} variant="outline" className="flex-1">
                    Ablehnen
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

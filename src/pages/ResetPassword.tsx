import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
// dbClient nur für PASSWORD_RECOVERY-Event-Subscription (Supabase Auth-State)
import { dbClient } from "@/lib/api/client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { validatePassword } from "@/lib/passwordPolicy";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation(["auth", "common"]);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Supabase parses the URL hash on load and emits a PASSWORD_RECOVERY event.
  useEffect(() => {
    const { data: { subscription } } = dbClient.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If user lands here without a recovery session, check existing session.
    dbClient.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setTimeout(() => { if (!ready) setInvalid(true); }, 1500);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pwValid = validatePassword(password).valid;
  const match = password === confirm && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) return toast.error(t("auth:policy_invalid"));
    if (!match) return toast.error(t("auth:passwords_do_not_match"));
    setLoading(true);
    const { data, error } = await api.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      return toast.error(t("common:error"), { description: error.message });
    }
    // Clear must_change_password and log
    if (data.user) {
      await api.users.clearMustChangePassword(data.user.id);
      await api.users.logPasswordEvent({
        targetUserId: data.user.id,
        performedBy: data.user.id,
        action: "forgot_reset",
      });
    }
    await api.auth.signOut();

    setLoading(false);
    toast.success(t("auth:reset_success"));
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
            <FlaskConical className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">Ceram ROX</span>
        </div>
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">{t("auth:reset_title")}</CardTitle>
            <CardDescription>{t("auth:reset_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {invalid && !ready ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-destructive">{t("auth:reset_invalid_link")}</p>
                <Button onClick={() => navigate("/auth")} className="w-full">{t("auth:back_to_login")}</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("auth:new_password")}</Label>
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                  <PasswordStrengthMeter password={password} />
                </div>
                <div className="space-y-2">
                  <Label>{t("auth:confirm_password")}</Label>
                  <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                  {confirm.length > 0 && !match && (
                    <p className="text-xs text-destructive">{t("auth:passwords_do_not_match")}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading || !pwValid || !match}>
                  {loading ? t("auth:sending") : t("auth:change_password")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

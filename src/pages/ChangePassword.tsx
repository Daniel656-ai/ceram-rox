import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
// dbClient unused below — entfernt
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { FlaskConical, ShieldAlert } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { validatePassword } from "@/lib/passwordPolicy";

export default function ChangePassword() {
  const navigate = useNavigate();
  const { t } = useTranslation(["auth", "common"]);
  const { user, mustChangePassword, refreshProfile, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const pwValid = validatePassword(password).valid;
  const match = password === confirm && password.length > 0;
  const distinct = current !== password || password.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (!pwValid) return toast.error(t("auth:policy_invalid"));
    if (!match) return toast.error(t("auth:passwords_do_not_match"));
    if (current === password) return toast.error(t("auth:password_same_as_old"));

    setLoading(true);
    // Re-authenticate to verify current password
    const { error: signInErr } = await api.auth.signInWithPassword({ email: user.email, password: current });
    if (signInErr) {
      setLoading(false);
      return toast.error(t("auth:current_password_wrong"));
    }
    const { error } = await api.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      return toast.error(t("common:error"), { description: error.message });
    }
    await api.users.clearMustChangePassword(user.id);
    await api.users.logPasswordEvent({
      targetUserId: user.id,
      performedBy: user.id,
      action: mustChangePassword ? "initial_set" : "self_change",
    });

    await refreshProfile();
    setLoading(false);
    toast.success(t("auth:password_changed"));
    if (mustChangePassword) navigate("/dashboard", { replace: true });
    else navigate(-1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
            <FlaskConical className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">Ceram ROX</span>
        </div>
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {mustChangePassword ? t("auth:must_change_title") : t("auth:change_password_title")}
            </CardTitle>
            <CardDescription>
              {mustChangePassword ? t("auth:must_change_description") : t("auth:change_password_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mustChangePassword && (
              <Alert className="mb-4 border-amber-400/50 bg-amber-50 dark:bg-amber-950/30">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertDescription>{t("auth:must_change_description")}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("auth:current_password")}</Label>
                <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className="space-y-2">
                <Label>{t("auth:new_password")}</Label>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                <PasswordStrengthMeter password={password} />
                {!distinct && (
                  <p className="text-xs text-destructive">{t("auth:password_same_as_old")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("auth:confirm_password")}</Label>
                <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                {confirm.length > 0 && !match && (
                  <p className="text-xs text-destructive">{t("auth:passwords_do_not_match")}</p>
                )}
              </div>
              <div className="flex gap-2">
                {!mustChangePassword && (
                  <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)} disabled={loading}>
                    {t("common:cancel")}
                  </Button>
                )}
                {mustChangePassword && (
                  <Button type="button" variant="outline" className="flex-1" onClick={signOut} disabled={loading}>
                    {t("common:sign_out")}
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={loading || !pwValid || !match || current === password}>
                  {loading ? t("auth:sending") : t("auth:change_password")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

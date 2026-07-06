import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { validatePassword } from "@/lib/passwordPolicy";

type AuthMode = "login" | "register" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const goNext = (fallback: string) => {
    if (safeNext) {
      window.location.href = safeNext;
    } else {
      navigate(fallback);
    }
  };
  const { t } = useTranslation(["auth", "common"]);
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const pwValid = validatePassword(password).valid;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await api.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(t("auth:login_failed"), { description: error.message });
    } else {
      navigate("/dashboard");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) {
      toast.error(t("auth:policy_invalid"));
      return;
    }
    setLoading(true);
    const { error } = await api.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(t("auth:register_failed"), { description: error.message });
    } else {
      toast.success(t("auth:register_success"), { description: t("auth:register_success_description") });
      setMode("login");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await api.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Stets generische Erfolgsmeldung (kein Account-Enumeration-Hinweis)
    if (error && error.message.toLowerCase().includes("rate")) {
      toast.error(t("common:error"), { description: error.message });
    } else {
      toast.success(t("auth:email_sent"), { description: t("auth:email_sent_description") });
      setMode("login");
    }
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
            <CardTitle className="text-xl">
              {mode === "login" && t("auth:login_title")}
              {mode === "register" && t("auth:register_title")}
              {mode === "forgot" && t("auth:forgot_title")}
            </CardTitle>
            <CardDescription>
              {mode === "login" && t("auth:login_description")}
              {mode === "register" && t("auth:register_description")}
              {mode === "forgot" && t("auth:forgot_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth:email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth:email_placeholder")} required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth:password")}</Label>
                  <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("auth:logging_in") : t("auth:login")}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setMode("forgot")} className="text-primary hover:underline">
                    {t("auth:forgot_password_link")}
                  </button>
                </div>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("auth:first_name")}</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("auth:last_name")}</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regEmail">{t("auth:email")}</Label>
                  <Input id="regEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth:email_placeholder")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regPassword">{t("auth:password")}</Label>
                  <PasswordInput id="regPassword" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth:min_password")} required autoComplete="new-password" />
                  <PasswordStrengthMeter password={password} />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !pwValid}>
                  {loading ? t("auth:registering") : t("auth:register")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t("auth:already_have_account")}{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    {t("auth:login")}
                  </button>
                </p>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">{t("auth:email")}</Label>
                  <Input id="forgotEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth:email_placeholder")} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("auth:sending") : t("auth:send_link")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    {t("auth:back_to_login")}
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

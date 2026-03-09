import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";

type AuthMode = "login" | "register" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(t("login_failed"), { description: error.message });
    } else {
      navigate("/dashboard");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(t("register_failed"), { description: error.message });
    } else {
      toast.success(t("register_success"), { description: t("register_success_description") });
      setMode("login");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) {
      toast.error(t("common:error"), { description: error.message });
    } else {
      toast.success(t("email_sent"), { description: t("email_sent_description") });
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
              {mode === "login" && t("login_title")}
              {mode === "register" && t("register_title")}
              {mode === "forgot" && t("forgot_title")}
            </CardTitle>
            <CardDescription>
              {mode === "login" && t("login_description")}
              {mode === "register" && t("register_description")}
              {mode === "forgot" && t("forgot_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email_placeholder")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("logging_in") : t("login")}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setMode("forgot")} className="text-primary hover:underline">
                    {t("forgot_password_link")}
                  </button>
                  <button type="button" onClick={() => setMode("register")} className="text-primary hover:underline">
                    {t("create_account")}
                  </button>
                </div>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("first_name")}</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("last_name")}</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regEmail">{t("email")}</Label>
                  <Input id="regEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email_placeholder")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regPassword">{t("password")}</Label>
                  <Input id="regPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("min_password")} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("registering") : t("register")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t("already_have_account")}{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    {t("login")}
                  </button>
                </p>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">{t("email")}</Label>
                  <Input id="forgotEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email_placeholder")} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("sending") : t("send_link")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    {t("back_to_login")}
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

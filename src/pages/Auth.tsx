import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      toast.error("Anmeldung fehlgeschlagen", { description: error.message });
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
      toast.error("Registrierung fehlgeschlagen", { description: error.message });
    } else {
      toast.success("Registrierung erfolgreich", {
        description: "Bitte bestätigen Sie Ihre E-Mail-Adresse.",
      });
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
      toast.error("Fehler", { description: error.message });
    } else {
      toast.success("E-Mail gesendet", {
        description: "Prüfen Sie Ihr Postfach für den Passwort-Reset-Link.",
      });
      setMode("login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
            <FlaskConical className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">Ceram ROX</span>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {mode === "login" && "Anmelden"}
              {mode === "register" && "Konto erstellen"}
              {mode === "forgot" && "Passwort zurücksetzen"}
            </CardTitle>
            <CardDescription>
              {mode === "login" && "Melden Sie sich mit Ihrer E-Mail-Adresse an"}
              {mode === "register" && "Erstellen Sie ein neues Benutzerkonto"}
              {mode === "forgot" && "Geben Sie Ihre E-Mail-Adresse ein"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@labor.de" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Wird angemeldet…" : "Anmelden"}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setMode("forgot")} className="text-primary hover:underline">
                    Passwort vergessen?
                  </button>
                  <button type="button" onClick={() => setMode("register")} className="text-primary hover:underline">
                    Konto erstellen
                  </button>
                </div>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Max" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mustermann" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regEmail">E-Mail</Label>
                  <Input id="regEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@labor.de" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regPassword">Passwort</Label>
                  <Input id="regPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mind. 6 Zeichen" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Wird registriert…" : "Registrieren"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Bereits ein Konto?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    Anmelden
                  </button>
                </p>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">E-Mail</Label>
                  <Input id="forgotEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@labor.de" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Wird gesendet…" : "Link senden"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    Zurück zur Anmeldung
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

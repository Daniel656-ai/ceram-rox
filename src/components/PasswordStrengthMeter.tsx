import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { validatePassword } from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { t } = useTranslation("auth");
  const { results } = validatePassword(password);
  const labels: Record<string, string> = {
    length: t("policy_length"),
    upper: t("policy_upper"),
    lower: t("policy_lower"),
    digit: t("policy_digit"),
    special: t("policy_special"),
  };
  return (
    <ul className="space-y-1 text-xs">
      {results.map((r) => (
        <li
          key={r.key}
          className={cn(
            "flex items-center gap-2",
            r.ok ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
          )}
        >
          {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          <span>{labels[r.key]}</span>
        </li>
      ))}
    </ul>
  );
}

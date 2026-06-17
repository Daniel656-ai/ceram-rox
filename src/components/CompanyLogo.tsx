import { useCompanyLogo, useCompanySettings } from "@/hooks/useCompanySettings";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  className?: string;
  /** Hide entirely when no logo is configured (default true). When false, a neutral placeholder is shown. */
  hideIfMissing?: boolean;
  alt?: string;
}

/**
 * Central company logo component. Reads the logo from `company_settings` once
 * (cached by react-query) and renders it. Used by headers, print views, labels.
 */
export function CompanyLogo({ className, hideIfMissing = true, alt }: CompanyLogoProps) {
  const logo = useCompanyLogo();
  const { data } = useCompanySettings();
  if (!logo) {
    if (hideIfMissing) return null;
    return <div className={cn("text-xs text-muted-foreground", className)}>{data?.company_name ?? ""}</div>;
  }
  return (
    <img
      src={logo}
      alt={alt ?? data?.company_name ?? "Logo"}
      className={cn("object-contain", className)}
      style={{ imageRendering: "auto" }}
    />
  );
}

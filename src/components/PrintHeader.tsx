import { useCompanySettings } from "@/hooks/useCompanySettings";

/**
 * Global print header that automatically appears at the top of every printed page.
 * Hidden on screen, visible only via `@media print`.
 * Mounted once at the app layout level — no per-page wiring needed.
 */
export function PrintHeader() {
  const { data: settings } = useCompanySettings();
  return (
    <div className="hidden print:flex print-header" aria-hidden>
      <div className="print-header-inner">
        {settings?.logo_data_url && (
          <img src={settings.logo_data_url} alt="Logo" className="print-header-logo" />
        )}
        <div className="print-header-name">{settings?.company_name ?? ""}</div>
      </div>
    </div>
  );
}

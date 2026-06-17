import { useCompanySettings } from "@/hooks/useCompanySettings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageOff, FileText, Printer, Tag } from "lucide-react";

interface LogoPreviewProps {
  /** Optional override (e.g. a pending upload not yet saved). */
  logoOverride?: string | null;
  nameOverride?: string;
}

function LogoPlaceholder({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "sm"
      ? "h-6 w-12 text-[8px]"
      : size === "lg"
      ? "h-16 w-32 text-xs"
      : "h-10 w-20 text-[10px]";
  return (
    <div
      className={`${cls} flex flex-col items-center justify-center rounded border border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground gap-0.5`}
      title="Kein Logo hinterlegt"
    >
      <ImageOff className="h-3 w-3" />
      <span className="leading-none">Kein Logo</span>
    </div>
  );
}

/**
 * Live preview of how the company logo appears across all printable surfaces:
 * - PDF / report header
 * - Browser print view header
 * - Sample label (medium size)
 *
 * Falls back to a neutral placeholder when no logo is configured.
 */
export function CompanyBrandingPreview({ logoOverride, nameOverride }: LogoPreviewProps) {
  const { data } = useCompanySettings();
  const logo = logoOverride !== undefined ? logoOverride : data?.logo_data_url ?? null;
  const name = nameOverride !== undefined ? nameOverride : data?.company_name ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live-Vorschau</CardTitle>
        <CardDescription>
          So erscheint das Logo automatisch in Berichten, PDFs, Druckansichten und Etiketten.
          {!logo && " Aktuell kein Logo hinterlegt – es wird ein neutraler Platzhalter angezeigt."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* === 1. Report / PDF header === */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Bericht / PDF-Header
          </div>
          <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="text-gray-800">
                <div className="text-xs uppercase tracking-wide text-gray-500">Projektbericht</div>
                <div className="text-lg font-semibold leading-tight">P2600042 – Demo-Projekt</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{name || "Firmenname"}</div>
              </div>
              {logo ? (
                <img src={logo} alt="Logo" className="max-h-12 max-w-[140px] object-contain" />
              ) : (
                <LogoPlaceholder size="lg" />
              )}
            </div>
            <div className="px-6 py-3 text-[11px] text-gray-400">
              Berichtsinhalt … (Tabellen, Kostenaufstellung, Messungen)
            </div>
          </div>
        </div>

        {/* === 2. Browser print view === */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Printer className="h-3.5 w-3.5" />
            Druckansicht (Browser)
          </div>
          <div className="rounded-md border bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">{name || "Firmenname"}</span>
              {logo ? (
                <img src={logo} alt="Logo" className="max-h-9 max-w-[100px] object-contain" />
              ) : (
                <LogoPlaceholder size="md" />
              )}
            </div>
            <div className="px-5 py-4 text-[11px] text-gray-400 space-y-1">
              <div className="h-2 w-3/4 rounded bg-gray-100" />
              <div className="h-2 w-2/3 rounded bg-gray-100" />
              <div className="h-2 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        </div>

        {/* === 3. Sample label === */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            Probenetikett (mittel, 70×40&nbsp;mm)
          </div>
          <div className="flex items-start gap-4 flex-wrap">
            {/* Medium label */}
            <div
              className="bg-white border rounded-sm shadow-sm p-2 font-sans"
              style={{ width: "210px", height: "120px" }}
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-bold text-[10pt] text-gray-900">P2600042</span>
                {logo ? (
                  <img src={logo} alt="Logo" className="max-h-5 max-w-[60px] object-contain" />
                ) : (
                  <LogoPlaceholder size="sm" />
                )}
              </div>
              <div className="text-[8pt] text-gray-600 truncate">Probe Demo Material</div>
              <div className="flex items-center justify-center gap-2 my-1">
                <div className="h-14 w-14 bg-gray-100 border flex items-center justify-center text-[7pt] text-gray-400">
                  QR
                </div>
                <div className="h-8 w-24 bg-gray-100 border flex items-center justify-center text-[7pt] text-gray-400">
                  Barcode
                </div>
              </div>
              <div className="flex justify-between text-[6pt] text-gray-400">
                <span>17.06.2026</span>
                <span>P2600042</span>
              </div>
            </div>

            {/* Small label note */}
            <div className="text-xs text-muted-foreground max-w-[260px] space-y-1 pt-1">
              <p>
                <span className="font-medium text-foreground">Kleine Etiketten (50×25&nbsp;mm)</span> verzichten
                auf das Logo, um die Lesbarkeit der Probennummer und der Codes zu erhalten.
              </p>
              <p>
                <span className="font-medium text-foreground">Große Etiketten (100×60&nbsp;mm)</span> zeigen das
                Logo proportional größer.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

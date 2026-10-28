import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSampleDetail } from "@/hooks/useSamples";
import { buildSampleDetailSections } from "@/lib/samples/sampleDetailRows";

/** Reine Anzeige der gespeicherten Probendaten; Bearbeitung bleibt in der Probenverwaltung. */
export default function SampleDetailsDialog({ sampleId, onClose }: { sampleId: string | null; onClose: () => void }) {
  const { t } = useTranslation("samples");
  const { data: sample, isLoading, isError, error } = useSampleDetail(sampleId ?? undefined);
  // Nur die zur geöffneten Kennung passende Probe anzeigen – nie einen vorherigen Eintrag.
  const current = sample && (sample as any).id === sampleId ? (sample as any) : null;

  return (
    <Dialog open={!!sampleId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {current ? `${current.sample_number} – ${current.sample_name}` : t("sample_details", { defaultValue: "Probendetails" })}
          </DialogTitle>
          <DialogDescription>Nur Anzeige. Änderungen erfolgen in der Probenverwaltung.</DialogDescription>
        </DialogHeader>
        {isLoading || (!current && !isError && sampleId) ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t("loading")}</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-6 text-center">
            Probendetails konnten nicht geladen werden{(error as any)?.message ? `: ${(error as any).message}` : "."}
          </p>
        ) : current ? (
          <div className="space-y-4">
            {buildSampleDetailSections(current, t as any).map((sec) => (
              <section key={sec.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{sec.title}</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-[minmax(140px,40%)_1fr] gap-x-4 gap-y-1 text-sm">
                  {sec.rows.map((r) => (
                    <div key={r.key} className="contents">
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className={r.value == null ? "text-muted-foreground italic" : "font-medium break-words"}>
                        {r.value ?? "Nicht angegeben"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

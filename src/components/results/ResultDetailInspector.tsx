import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, FileText, History } from "lucide-react";
import { toast } from "sonner";
import MeasurementCurvesCard from "@/components/curves/MeasurementCurvesCard";
import OrderUploadedFiles from "@/components/OrderUploadedFiles";
import CorrectionHistoryDialog from "@/components/results/CorrectionHistoryDialog";
import ResultCorrectionDialog, { type CorrectionContext } from "@/components/results/ResultCorrectionDialog";
import { SampleMeasurementResultsTable } from "@/components/results/SampleResultsView";
import { formatSampleDate, type SampleMeasurementRecord } from "@/lib/results/sampleResultsAggregation";

/** Read-only Vorschau des auftragsbezogenen Ergebnisberichts (Ebene 3). */
function OrderReportPreview({ measurement }: { measurement: SampleMeasurementRecord }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ["order-report-readonly", measurement.orderId],
    queryFn: () => api.orderReports.getForOrder(measurement.orderId),
    enabled: !!measurement.orderId,
  });
  const { data: versions = [] } = useQuery({
    queryKey: ["order-report-versions", report?.id],
    queryFn: () => api.orderReports.listVersions(report!.id),
    enabled: !!report?.id,
  });

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const openPreview = async (path: string | null) => {
    if (!path) return;
    try {
      const blob = await api.orderReports.downloadPdf(path);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast.error("Vorschau nicht möglich", { description: e?.message });
    }
  };

  const download = async (path: string | null, versionNo: number) => {
    if (!path) return;
    try {
      const blob = await api.orderReports.downloadPdf(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ergebnisbericht_${measurement.orderDisplayNumber || measurement.orderNumber}_v${versionNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Download nicht möglich", { description: e?.message });
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Bericht wird geladen…</p>;
  if (!report || versions.length === 0)
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        Für den Gesamtauftrag <span className="font-mono">{measurement.orderDisplayNumber || measurement.orderNumber}</span> wurde
        bisher kein Ergebnisbericht erzeugt. Die Erstellung erfolgt unverändert im Auftrag selbst.
      </p>
    );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Der Ergebnisbericht ist auftragsbezogen und umfasst alle Proben des Gesamtauftrags{" "}
        <span className="font-mono">{measurement.orderDisplayNumber || measurement.orderNumber}</span>.
      </p>
      <div className="space-y-2">
        {versions.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Version {v.version_no}</span>
            {v.approved_at && <Badge variant="default" className="text-[10px]">freigegeben</Badge>}
            <span className="text-xs text-muted-foreground">{formatSampleDate(v.created_at)}</span>
            {v.change_reason && <span className="text-xs text-muted-foreground">· {v.change_reason}</span>}
            <span className="ml-auto flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openPreview(v.pdf_storage_path)}>
                <Eye className="mr-1 h-3.5 w-3.5" /> Vorschau
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => download(v.pdf_storage_path, v.version_no)}>
                <Download className="mr-1 h-3.5 w-3.5" /> PDF
              </Button>
            </span>
          </div>
        ))}
      </div>
      {previewUrl && (
        <iframe title="Ergebnisbericht-Vorschau" src={previewUrl} className="h-[70vh] w-full rounded-md border" />
      )}
    </div>
  );
}

/**
 * Ebene 3: Detail-Inspektor einer einzelnen Analyse (Messwerte, Rohdaten &
 * Kurven, Dateien, Änderungshistorie, auftragsbezogener Ergebnisbericht).
 */
export default function ResultDetailInspector({
  measurement,
  onClose,
}: {
  measurement: SampleMeasurementRecord | null;
  onClose: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [correction, setCorrection] = useState<CorrectionContext | null>(null);

  return (
    <Sheet open={!!measurement} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        {measurement && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {measurement.serviceName || "Messung"}
                <Badge variant="outline" className="font-mono text-[10px]">{measurement.measurementNumber}</Badge>
              </SheetTitle>
              <SheetDescription asChild>
                <div className="space-y-0.5 text-xs">
                  <div>
                    Probe: <span className="font-mono">{measurement.sampleNumber || "–"}</span>
                    {measurement.sampleName ? ` · ${measurement.sampleName}` : ""}
                  </div>
                  <div>
                    Auftrag: <span className="font-mono">{measurement.orderDisplayNumber || measurement.orderNumber}</span>
                    {measurement.projectName ? ` · Projekt ${measurement.projectName}` : ""}
                  </div>
                </div>
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="values" className="mt-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="values">Messwerte</TabsTrigger>
                <TabsTrigger value="curves">Rohdaten & Kurven</TabsTrigger>
                <TabsTrigger value="files">Dateien</TabsTrigger>
                <TabsTrigger value="history">Änderungshistorie</TabsTrigger>
                <TabsTrigger value="report">Ergebnisbericht</TabsTrigger>
              </TabsList>

              <TabsContent value="values" className="mt-3">
                <SampleMeasurementResultsTable measurement={measurement} onCorrect={setCorrection} />
              </TabsContent>

              <TabsContent value="curves" className="mt-3">
                <MeasurementCurvesCard measurementId={measurement.measurementId} readOnly />
              </TabsContent>

              <TabsContent value="files" className="mt-3">
                <OrderUploadedFiles measurementId={measurement.measurementId} canDelete={false} />
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Lückenloser, unveränderbarer Änderungsverlauf dieser Analyse.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
                    <History className="mr-1 h-4 w-4" /> Änderungshistorie öffnen
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="report" className="mt-3">
                <OrderReportPreview measurement={measurement} />
              </TabsContent>
            </Tabs>

            <CorrectionHistoryDialog
              open={historyOpen}
              onOpenChange={setHistoryOpen}
              measurementId={measurement.measurementId}
              measurementNumber={measurement.measurementNumber}
            />
            <ResultCorrectionDialog
              open={!!correction}
              onOpenChange={(o) => !o && setCorrection(null)}
              context={correction}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

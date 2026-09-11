import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PlateGeometrySection from "./PlateGeometrySection";
import {
  GEOMETRY_KIND_LABELS,
  geometryKindsForServices,
  HONEYCOMB_GEOMETRY_KIND,
  PLATE_GEOMETRY_KIND,
} from "@/lib/geometry/kinds";
import { emptyPlateGeometryData, parsePlateGeometryData, type PlateGeometryData } from "@/lib/geometry/plate";
import { reactorGeometryFor } from "@/lib/geometry/masterData";

/**
 * Geometrieabschnitte einer Probe innerhalb der bestehenden
 * Geometrievermessung.
 *
 * Fachliche Regel:
 *   gleiche Probe + gleiche Geometrieart → ein gemeinsamer Datensatz
 *     (BENCH NOx und BENCH SOx teilen sich die Plattengeometrie)
 *   gleiche Probe + andere Geometrieart  → getrennter Datensatz
 *     (NOx-Wabenkörper wird nie von der Plattengeometrie überschrieben)
 *
 * Der Wabenkörperabschnitt (inkl. Mikroskop-Import) bleibt unverändert im
 * bestehenden Messdienstleisterformular – hier wird nur darauf verwiesen.
 */
interface Props {
  sampleId: string;
  profileId?: string | null;
  readOnly?: boolean;
}

export default function SampleGeometryCard({ sampleId, profileId, readOnly }: Props) {
  const qc = useQueryClient();

  const { data: sampleMeasurements = [] } = useQuery({
    queryKey: ["sample-measurements", sampleId],
    queryFn: () => api.samples.listMeasurements(sampleId),
    enabled: !!sampleId,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["master-data-catalog"],
    queryFn: () => api.masterData.catalog(),
  });

  const serviceNames = useMemo(
    () =>
      (sampleMeasurements as Array<{ measurement_services?: { service_name?: string } | null }>).map(
        (m) => m.measurement_services?.service_name ?? null,
      ),
    [sampleMeasurements],
  );

  const kinds = useMemo(() => geometryKindsForServices(serviceNames), [serviceNames]);
  const showPlate = kinds.includes(PLATE_GEOMETRY_KIND);

  const { data: dataset } = useQuery({
    queryKey: ["sample-geometry", sampleId, PLATE_GEOMETRY_KIND],
    queryFn: () => api.sampleGeometry.get(sampleId, PLATE_GEOMETRY_KIND),
    enabled: !!sampleId && showPlate,
  });

  const [plate, setPlate] = useState<PlateGeometryData>(emptyPlateGeometryData());
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showPlate) return;
    const key = `${sampleId}:${dataset?.id ?? "neu"}`;
    if (loadedFor === key) return;
    setPlate(dataset ? parsePlateGeometryData(dataset.data) : emptyPlateGeometryData());
    setLoadedFor(key);
  }, [dataset, sampleId, showPlate, loadedFor]);

  const reactor = useMemo(
    () => reactorGeometryFor(catalog, plate.reaktorgeometrie ?? undefined),
    [catalog, plate.reaktorgeometrie],
  );

  const save = async () => {
    setSaving(true);
    try {
      await api.sampleGeometry.save(sampleId, PLATE_GEOMETRY_KIND, plate as unknown as Record<string, unknown>, profileId ?? null);
      await qc.invalidateQueries({ queryKey: ["sample-geometry", sampleId, PLATE_GEOMETRY_KIND] });
      toast.success("Plattengeometrie gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  if (!showPlate) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">{GEOMETRY_KIND_LABELS[PLATE_GEOMETRY_KIND]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {kinds.includes(HONEYCOMB_GEOMETRY_KIND) && (
          <p className="text-xs text-muted-foreground">
            Die Wabenkörper-Geometrie (inkl. Mikroskop-Import) wird unverändert im
            Messdienstleisterformular oben erfasst und bleibt von diesem Abschnitt getrennt.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Diese Plattengeometrie gilt für alle BENCH-Dienstleistungen dieser Probe gemeinsam.
        </p>
        <PlateGeometrySection data={plate} reactor={reactor} readOnly={readOnly} onChange={setPlate} />
        {!readOnly && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              Plattengeometrie speichern
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

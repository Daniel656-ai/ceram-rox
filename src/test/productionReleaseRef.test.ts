import { describe, it, expect } from "vitest";
import {
  buildProductionReleaseSource,
  matchesReleaseSearch,
  readProductionReleaseSource,
  releaseRevisionLabel,
  resolveProductionReleaseField,
  type ReleaseRevisionOption,
} from "@/lib/productionReleaseRef";
import { readValueSource } from "@/lib/fieldLinks";

const rev1 = {
  id: "rev1-id",
  release_number: "0020-6047",
  revision_number: 1,
  project_name: "UBE #6 (2027)",
  article_number: "0020-6047-125-0998",
  length_mm: 1200,
  form_data: { av_nox: "12,5" },
};

const rev2 = { ...rev1, id: "rev2-id", revision_number: 2, length_mm: 1500 };

const option = (o: Partial<ReleaseRevisionOption>): ReleaseRevisionOption => ({
  id: "x", release_number: "0020-6047", revision_number: 1, project_name: "UBE #6 (2027)",
  customer_name: "Kunde AG", article_number: "0020-6047-125-0998", order_id: null,
  order_number: "0020-6047", is_current: true, superseded_at: null, ...o,
});

describe("Quelle: konkrete Fertigungsfreigabe-Revision", () => {
  it("liest die Wertquelle mit konkreter release_id", () => {
    const ds = buildProductionReleaseSource({ release_id: "rev1-id", field_key: "length_mm" });
    const ref = readProductionReleaseSource(ds);
    expect(ref?.release_id).toBe("rev1-id");
    expect(ref?.field_key).toBe("length_mm");
  });

  it("beschädigt die bestehenden Wertquellen nicht", () => {
    const linked = readValueSource({ id: "f", data_source: { mode: "copy", source: { kind: "linked_form", form_id: "geo", field_key: "ap" } } } as never);
    expect(linked?.source.kind).toBe("linked_form");
    const rel = readValueSource({ id: "f", data_source: buildProductionReleaseSource({ release_id: "rev1-id", field_key: "length_mm" }) } as never);
    expect(rel?.source.kind).toBe("production_release_field");
    expect(rel?.source.release_id).toBe("rev1-id");
  });

  it("löst den Wert genau aus der gespeicherten Revision auf", () => {
    const res = resolveProductionReleaseField({ release_id: "rev1-id", field_key: "length_mm" }, rev1);
    expect(res).toMatchObject({ status: "ok", value: 1200, unit: "mm" });
  });

  it("wechselt bei Rev2 nicht stillschweigend die Quelle", () => {
    const res = resolveProductionReleaseField({ release_id: "rev1-id", field_key: "length_mm" }, rev2);
    expect(res.status).toBe("missing");
    const rev2Ref = resolveProductionReleaseField({ release_id: "rev2-id", field_key: "length_mm" }, rev2);
    expect(rev2Ref).toMatchObject({ status: "ok", value: 1500 });
  });

  it("liefert einen missing-Zustand statt eines Ersatzwertes", () => {
    expect(resolveProductionReleaseField({ release_id: "rev1-id", field_key: "v2o5_percent" }, rev1).status).toBe("missing");
    expect(resolveProductionReleaseField({ release_id: "rev1-id", field_key: "length_mm" }, null).status).toBe("missing");
  });

  it("findet Werte auch im form_data derselben Revision", () => {
    expect(resolveProductionReleaseField({ release_id: "rev1-id", field_key: "av_nox" }, rev1)).toMatchObject({
      status: "ok", value: "12,5",
    });
  });

  it("sucht flexibel über Auftrag, Projekt, Artikelnummer und Revision", () => {
    const o = option({ id: "a" });
    expect(matchesReleaseSearch(o, "UBE #6")).toBe(true);
    expect(matchesReleaseSearch(o, "0020-6047-125-0998")).toBe(true);
    expect(matchesReleaseSearch(o, "UBE #6 0020-6047")).toBe(true);
    expect(matchesReleaseSearch(o, "rev1")).toBe(true);
    expect(matchesReleaseSearch(o, "rev2")).toBe(false);
    expect(matchesReleaseSearch(o, "Siemens")).toBe(false);
  });

  it("macht die Revision im Treffer eindeutig sichtbar", () => {
    expect(releaseRevisionLabel(option({ revision_number: 1 }))).toContain("Rev1");
    expect(releaseRevisionLabel(option({ revision_number: 2 }))).toContain("Rev2");
  });
});

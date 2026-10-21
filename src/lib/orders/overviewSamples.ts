/** Read-only projection of explicit sample links for the order overview. */
export interface OverviewSample {
  id: string;
  sample_name: string | null;
  sample_number: string | null;
}

interface SampleLinkedOrder {
  order_samples?: Array<{
    id?: string;
    created_at?: string | null;
    samples?: OverviewSample | null;
  }> | null;
  samples?: OverviewSample | null;
}

/** Stable primary association order; historical single association only as fallback. */
export function orderOverviewSamples(order: SampleLinkedOrder): OverviewSample[] {
  const links = [...(order.order_samples ?? [])].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
    (a.id ?? a.samples?.id ?? "").localeCompare(b.id ?? b.samples?.id ?? ""),
  );
  const unique = new Map<string, OverviewSample>();
  for (const link of links) {
    const sample = link.samples;
    if (sample?.id && !unique.has(sample.id)) unique.set(sample.id, sample);
  }
  if (unique.size === 0 && order.samples?.id) unique.set(order.samples.id, order.samples);
  return [...unique.values()];
}

export function overviewSampleLabel(sample: OverviewSample): string {
  return sample.sample_name?.trim() || sample.sample_number?.trim() || "–";
}

export function orderSamplesMatchSearch(order: SampleLinkedOrder, search: string): boolean {
  const query = search.toLowerCase();
  return orderOverviewSamples(order).some(sample =>
    sample.sample_name?.toLowerCase().includes(query) ||
    sample.sample_number?.toLowerCase().includes(query),
  );
}

export function orderSampleSortValue(order: SampleLinkedOrder): string {
  const first = orderOverviewSamples(order)[0];
  return first ? overviewSampleLabel(first) : "";
}
export type OrderSampleRef = {
  id: string;
  sample_name: string | null;
  sample_number: string | null;
  category?: string | null;
};

type LinkedSample = OrderSampleRef & {
  order_id?: string | null;
  pilot_plant_order_id?: string | null;
};

export type OrderSampleSource = {
  id: string;
  sample_id?: string | null;
  current_sample?: OrderSampleRef | null;
  samples?: OrderSampleRef | null;
  order_samples?: Array<{ sample_id?: string | null; samples?: OrderSampleRef | null }> | null;
  order_measurements?: Array<{ sample_id?: string | null; current_sample?: OrderSampleRef | null; samples?: OrderSampleRef | null }> | null;
  linked_samples?: LinkedSample[] | null;
  produced_samples?: LinkedSample[] | null;
};

/** Only hydrated, RLS-readable samples on explicit current-order relations. */
export function orderSamples(order: OrderSampleSource): OrderSampleRef[] {
  const byId = new Map<string, OrderSampleRef>();
  const add = (sample: OrderSampleRef | null | undefined, expectedId: string | null | undefined) => {
    if (!sample?.id || sample.id !== expectedId) return;
    if (!byId.has(sample.id)) byId.set(sample.id, sample);
  };
  add(order.current_sample ?? order.samples, order.sample_id);
  for (const link of order.order_samples ?? []) add(link.samples, link.sample_id);
  for (const measurement of order.order_measurements ?? []) add(measurement.current_sample ?? measurement.samples, measurement.sample_id);
  for (const sample of order.linked_samples ?? []) {
    if (sample.order_id === order.id) add(sample, sample.id);
  }
  for (const sample of order.produced_samples ?? []) {
    if (sample.pilot_plant_order_id === order.id) add(sample, sample.id);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function orderSampleLinks(order: OrderSampleSource) {
  return sampleLinks(orderSamples(order));
}

/** Presentation only: callers must supply explicitly associated, hydrated samples. */
export function sampleLinks(readable: OrderSampleRef[]) {
  const nameCounts = new Map<string, number>();
  for (const sample of readable) {
    const name = sample.sample_name?.trim();
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  return readable.map(sample => {
    const name = sample.sample_name?.trim();
    const number = sample.sample_number?.trim();
    return {
      id: sample.id,
      href: `/proben/${sample.id}`,
      label: name && (nameCounts.get(name) ?? 0) > 1 && number
        ? `${name} (${number})`
        : name || number || "–",
    };
  });
}

export function samplesMatchSearch(samples: OrderSampleRef[], query: string): boolean {
  const q = query.trim().toLowerCase();
  return samples.some(sample => [sample.sample_name, sample.sample_number]
    .some(value => !!value?.toLowerCase().includes(q)));
}

/** Never substitute an order-level sample for the task's own sample. */
export function taskSamples(task: { sample_id?: string | null; samples?: OrderSampleRef | null }): OrderSampleRef[] {
  return task.sample_id && task.samples?.id === task.sample_id ? [task.samples] : [];
}
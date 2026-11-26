- m³ sample retrofit: only master RPC m3_retrofit_order_samples (atomic, audited), planned by pure analyzeM3Retrofit (lib/m3List/retrofit.ts) reusing planM3Samples; ambiguity → no change.

- m³ edits use document-keyed hydrated state and productionDocuments.saveM3 compare-and-swap on updated_at + previous JSON; verified returned snapshots never overwrite newer local input.
- Tolerances initialize once via workingValues from the explicit release catalogue mapping, preserving owned null/empty values and legacy inputs; rowServices plans per-sample overrides before any creation write and blocks retrofit overrides.

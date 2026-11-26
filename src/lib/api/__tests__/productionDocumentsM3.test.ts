import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbMock } from './dbClientMock';
vi.mock('../client', async () => ({ dbClient: (await import('./dbClientMock')).dbMock.client }));
const { productionDocuments } = await import('../productionDocuments');
const expected = { updated_at: '2026-11-26T09:00:00Z' };
const fields = { form_definition_id: 'form', form_values: { m3_rows: [{ volume_m3: '4', row_remarks: 'A', row_lab_tests_selected: [] }], inner_wall_tolerance: '+0,02/-0,05 mm' } };
beforeEach(() => dbMock.reset());
describe('atomic m³ save', () => {
  it('compares identity and updated_at without putting form_values in query filters and verifies the returned row', async () => {
    const row = { id: 'doc', ...fields, updated_at: 'new' };
    dbMock.respond('production_document_requests', { data: row, error: null });
    await expect(productionDocuments.saveM3('doc', expected, fields)).resolves.toEqual(row);
    const q = dbMock.queriesFor('production_document_requests')[0];
    expect(dbMock.calls(q, 'eq')).toEqual([['id', 'doc'], ['doc_kind', 'm3_list'], ['updated_at', expected.updated_at]]);
    expect(dbMock.calls(q, 'update')).toEqual([[fields]]);
    expect('updated_at' in (dbMock.calls(q, 'update')[0][0] as Record<string, unknown>)).toBe(false);
    expect(dbMock.calls(q, 'maybeSingle')).toHaveLength(1);
  });
  it('saves a large m³ list with 100 rows without placing form_values in URL filters', async () => {
    const largeRows = Array.from({ length: 100 }, (_, i) => ({
      __m3_row_id: `row-${i + 1}`,
      volume_m3: String((i + 1) * 0.5),
      row_remarks: `Bemerkung Zeile ${i + 1} mit ausführlichem Text für Belastungstest`,
      row_lab_tests_selected: i % 2 === 0 ? ['NOx', 'SOx'] : [],
    }));
    const largeFields = {
      form_definition_id: 'form',
      form_values: {
        m3_rows: largeRows,
        length_tolerance: '+1/-1 mm',
        diameter_tolerance: '±0,5 mm',
        inner_wall_tolerance: '+0,02/-0,05 mm',
      },
    };
    const row = { id: 'doc', ...largeFields, updated_at: '2026-11-26T09:05:00Z' };
    dbMock.respond('production_document_requests', { data: row, error: null });
    await expect(productionDocuments.saveM3('doc', expected, largeFields)).resolves.toEqual(row);
    const q = dbMock.queriesFor('production_document_requests')[0];
    const eqCalls = dbMock.calls(q, 'eq');
    expect(eqCalls).toEqual([['id', 'doc'], ['doc_kind', 'm3_list'], ['updated_at', expected.updated_at]]);
    expect(eqCalls.some(([col]) => col === 'form_values')).toBe(false);
    expect(dbMock.calls(q, 'update')).toEqual([[largeFields]]);
  });
  it('zero affected rows are a conflict, never success', async () => {
    dbMock.respond('production_document_requests', { data: null, error: null });
    await expect(productionDocuments.saveM3('doc', expected, fields)).rejects.toThrow(/Speicherkonflikt/);
  });
  it('network/update errors are propagated', async () => {
    const error = { message: 'Network failed' };
    dbMock.respond('production_document_requests', { data: null, error });
    await expect(productionDocuments.saveM3('doc', expected, fields)).rejects.toEqual(error);
  });
  it('returned JSON mismatch or wrong identity is rejected', async () => {
    dbMock.respond('production_document_requests', { data: { id: 'doc', form_definition_id: 'form', form_values: {} }, error: null });
    await expect(productionDocuments.saveM3('doc', expected, fields)).rejects.toThrow(/Speicherstand/);
  });
  it('JSON key order is irrelevant to verification', async () => {
    const row = { id: 'doc', ...fields, form_values: { inner_wall_tolerance: fields.form_values.inner_wall_tolerance, m3_rows: fields.form_values.m3_rows } };
    dbMock.respond('production_document_requests', { data: row, error: null });
    await expect(productionDocuments.saveM3('doc', expected, fields)).resolves.toEqual(row);
  });
});

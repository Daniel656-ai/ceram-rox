import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbMock } from './dbClientMock';
vi.mock('../client', async () => ({ dbClient: (await import('./dbClientMock')).dbMock.client }));
const { productionDocuments } = await import('../productionDocuments');
const expected = { updated_at: '2026-11-26T09:00:00Z', form_values: { m3_rows: [] } };
const fields = { form_definition_id: 'form', form_values: { m3_rows: [{ volume_m3: '4', row_remarks: 'A', row_lab_tests_selected: [] }], inner_wall_tolerance: '+0,02/-0,05 mm' } };
beforeEach(() => dbMock.reset());
describe('atomic m³ save', () => {
  it('compares timestamp AND prior JSON in the same UPDATE and verifies the returned row', async () => {
    const row = { id: 'doc', ...fields, updated_at: 'new' };
    dbMock.respond('production_document_requests', { data: row, error: null });
    await expect(productionDocuments.saveM3('doc', expected, fields)).resolves.toEqual(row);
    const q = dbMock.queriesFor('production_document_requests')[0];
    expect(dbMock.calls(q, 'eq')).toEqual([['id', 'doc'], ['doc_kind', 'm3_list'], ['updated_at', expected.updated_at], ['form_values', JSON.stringify(expected.form_values)]]);
    expect(dbMock.calls(q, 'update')).toEqual([[fields]]);
    expect(dbMock.calls(q, 'maybeSingle')).toHaveLength(1);
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

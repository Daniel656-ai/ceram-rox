import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import M3ListForm from '@/components/productionDocuments/M3ListForm';
import type { FormField } from '@/lib/api/formFields';
import { canonicalM3 } from '@/lib/m3List/workingValues';
const state = vi.hoisted(() => ({ docs: {} as Record<string, any>, save: vi.fn(), get: vi.fn(), orders: vi.fn(), samples: vi.fn(), measurements: vi.fn(), update: vi.fn(), resolve: vi.fn(), releaseGet: vi.fn(), print: vi.fn(), error: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ role: 'master', user: { id: 'user' }, customRoleNames: ['Administrator'] }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock('@/context/ProcessContextProvider', () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock('@/components/measurementImport/MeasurementCaseEditorDialog', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: state.error, warning: vi.fn() } }));
vi.mock('@/lib/m3List/m3PrintActions', () => ({ printM3List: state.print, downloadM3Pdf: state.print }));
vi.mock('@/lib/m3List/constants', () => ({ readM3Constants: () => ({ constants: { crossSectionM: .15, pressureTestMm: 150, rsmMaxMm: 350, laborKatAddMm: 50, elementRounding: 10 }, missing: [] }) }));
const field = (id: string, key: string, type: string, parent: string | null = null, readonly = false, metadata = {}): FormField => ({
  id, form_id: 'form', field_key: key, display_name: key, field_type: type, parent_field_id: parent, readonly, metadata,
  sort_order: 0, select_options: [], validation: {}, is_result: false, default_value: null, unit: null,
} as FormField);
const fields = [field('r', 'm3_rows', 'repeater', null, false, { repeater: { min_entries: 1, table_view: true, item_label: 'm³-Zeile', add_label: 'm³-Zeile hinzufügen' } }),
  field('v', 'volume_m3', 'decimal', 'r'), field('e', 'element_count', 'number', 'r', true), field('a', 'row_responsible', 'text', 'r'),
  field('lt', 'length_tolerance', 'text', null, true), field('dt', 'diameter_tolerance', 'text', null, true), field('wt', 'inner_wall_tolerance', 'text', null, true)];
const release = { id: 'release', article_number: '0020-6047-125', length_mm: 520, length_tolerance: '±3 mm', cross_section_tolerance: '±2 mm', inner_wall_tolerance: '+0,02/−0,05 mm' };
vi.mock('@/lib/api', () => ({ api: {
  productionDocuments: { get: state.get, saveM3: state.save, update: state.update, linkReleaseToOrder: vi.fn() },
  productionReleases: { get: state.releaseGet },
  formDefinitions: { get: async () => ({ layout: { version: 1, nodes: [{ id: 'node', type: 'field', field_id: 'r', width: 12 }] } }), list: async () => [] },
  formFields: { listForForm: async () => fields }, formFieldPermissions: { getEffectiveMap: async () => new Map() },
  globalFields: { list: async () => [] }, formCalculations: { listForForm: async () => [] },
  measurementServices: { listActive: async () => [], resolveSamplingCodes: state.resolve },
  orders: { create: state.orders }, samples: { findExistingNumbers: async () => [], create: state.samples },
  measurements: { add: state.measurements }, orderSamples: { add: vi.fn(), list: async () => [] },
} }));
function doc(id: string, values = {}): any { return { id, doc_kind: 'm3_list', form_definition_id: 'form', based_on_release_id: 'release', form_values: values, updated_at: 'v1', order_id: null }; }
function mount(id = 'a') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><M3ListForm requestId={id} /></QueryClientProvider>);
  return { ...view, client, switchTo: (next: string) => view.rerender(<QueryClientProvider client={client}><M3ListForm requestId={next} /></QueryClientProvider>) };
}
function volume(container: HTMLElement, i = 0): HTMLInputElement {
  const inputs = container.querySelectorAll<HTMLInputElement>('[data-repeater-key="m3_rows"] input:not([disabled])');
  const input = inputs[i * 2];
  if (!input) throw new Error('volume input not found');
  return input;
}
async function ready(container: HTMLElement) { await waitFor(() => expect(container.querySelector('[data-repeater-key="m3_rows"] input:not([disabled])')).not.toBeNull()); }
async function save() { fireEvent.click(screen.getByRole('button', { name: 'm³-Liste speichern' })); await waitFor(() => expect(state.save).toHaveBeenCalled()); }
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  state.docs = { a: doc('a'), b: doc('b', { m3_rows: [{ volume_m3: '9', row_remarks: 'B' }] }) };
  state.get.mockImplementation(async id => structuredClone(state.docs[id]));
  state.releaseGet.mockResolvedValue(release);
  state.save.mockImplementation(async (id, expected, patch) => {
    if (expected.updated_at !== state.docs[id].updated_at || canonicalM3(expected.form_values) !== canonicalM3(state.docs[id].form_values)) throw new Error('Speicherkonflikt');
    state.docs[id] = { ...state.docs[id], ...structuredClone(patch), updated_at: state.docs[id].updated_at + 'x' };
    return structuredClone(state.docs[id]);
  });
  state.orders.mockResolvedValue({ id: 'new-order' });
  state.update.mockImplementation(async (id, patch) => { state.docs[id] = { ...state.docs[id], ...patch, updated_at: 'linked' }; });
  state.samples.mockImplementation(async (_data, options) => ({ id: options.explicitNumber, sample_number: options.explicitNumber }));
  state.measurements.mockResolvedValue({ id: 'task' });
  state.resolve.mockImplementation(async (codes: string[]) => ({ matched: codes.map(code => ({ id: code, code, service_name: code })), missing: [] }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('document-bound m³ editor with real shared renderer', () => {
  it('waits for hydration before seeding and retains the loaded first row', async () => {
    let resolve: (doc: any) => void = () => {};
    state.get.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const { container } = mount();
    expect(container.querySelector('input')).toBeNull();
    resolve(doc('a', { m3_rows: [{ volume_m3: '4' }] }));
    await ready(container);
    expect(volume(container).value).toBe('4');
  });
  it('stores the first 4 m³ input and restores 00340 after a full close/reopen', async () => {
    const first = mount(); await ready(first.container);
    fireEvent.change(volume(first.container), { target: { value: '4' } });
    await save(); await waitFor(() => expect(state.docs.a.form_values.m3_rows[0].volume_m3).toBe('4'));
    expect(state.docs.a.form_values.m3_rows[0].element_count).toBeUndefined();
    first.unmount();
    const second = mount(); await ready(second.container);
    expect(volume(second.container).value).toBe('4');
    expect(second.container.querySelector('input[value="00340"]')).not.toBeNull();
  });
  it('keeps decimals, remarks and overrides together on the saved row', async () => {
    const { container } = mount(); await ready(container);
    fireEvent.change(volume(container), { target: { value: '1,5' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Bemerkung · m³-Zeile 1' }), { target: { value: 'A\n<&>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Messungen für m³-Zeile 1 bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /^Übernehmen$/ }));
    await save();
    await waitFor(() => expect(state.docs.a.form_values.m3_rows[0]).toMatchObject({ volume_m3: '1,5', row_remarks: 'A\n<&>', row_lab_tests_selected: expect.any(Array) }));
  });
  it('switching documents never carries local input across IDs', async () => {
    const view = mount(); await ready(view.container);
    fireEvent.change(volume(view.container), { target: { value: '4' } });
    view.switchTo('b'); await ready(view.container);
    expect(volume(view.container).value).toBe('9');
    expect(screen.getByRole('textbox', { name: 'Bemerkung · m³-Zeile 1' })).toHaveValue('B');
    await save();
    expect(state.save.mock.calls[0][0]).toBe('b');
    expect(state.docs.a.form_values).toEqual({});
  });
  it('an older pending save cannot overwrite newer typing; the next save uses the returned version', async () => {
    const view = mount(); await ready(view.container);
    fireEvent.change(volume(view.container), { target: { value: '4' } });
    let complete: (row: any) => void = () => {};
    state.save.mockImplementationOnce((_id, _expected, patch) => new Promise(r => { state.docs.a = { ...state.docs.a, ...patch, updated_at: 'v2' }; complete = r; }));
    await save();
    fireEvent.change(volume(view.container), { target: { value: '5' } });
    complete(structuredClone(state.docs.a));
    await waitFor(() => expect(screen.getByRole('button', { name: 'm³-Liste speichern' })).not.toBeDisabled());
    expect(volume(view.container).value).toBe('5');
    fireEvent.click(screen.getByRole('button', { name: 'm³-Liste speichern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(2));
    expect(state.save.mock.calls[1][1].updated_at).toBe('v2');
    expect(state.save.mock.calls[1][2].form_values.m3_rows[0].volume_m3).toBe('5');
  });
  it('network failure retains input and never creates tasks', async () => {
    const view = mount(); await ready(view.container);
    state.save.mockRejectedValueOnce(new Error('Netzfehler'));
    fireEvent.change(volume(view.container), { target: { value: '4' } });
    await save(); await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(volume(view.container).value).toBe('4');
    expect(state.measurements).not.toHaveBeenCalled();
    expect(state.docs.a.form_values).toEqual({});
  });
  it('concurrent document changes fail rather than silently overwrite', async () => {
    const view = mount(); await ready(view.container);
    fireEvent.change(volume(view.container), { target: { value: '4' } });
    state.docs.a = doc('a', { m3_rows: [{ volume_m3: '8' }] });
    await save(); await waitFor(() => expect(state.error).toHaveBeenCalledWith('Speicherkonflikt'));
    expect(volume(view.container).value).toBe('4');
    expect(state.docs.a.form_values.m3_rows[0].volume_m3).toBe('8');
  });
  it('moving and duplicating rows retains remarks/overrides but gives the duplicate a fresh TEST identity', async () => {
    state.docs.a = doc('a', { m3_rows: [{ volume_m3: '4', __m3_row_id: 'r1', row_remarks: 'A', row_lab_tests_selected: [] }, { volume_m3: '2', __m3_row_id: 'r2', row_remarks: 'B' }], test_charge_row_id: 'r1' });
    const view = mount(); await ready(view.container);
    fireEvent.click(screen.getAllByTitle('Nach unten')[0]);
    fireEvent.click(screen.getAllByTitle('Duplizieren')[1]);
    await save();
    await waitFor(() => expect(state.docs.a.form_values.m3_rows).toHaveLength(3));
    const rows = state.docs.a.form_values.m3_rows;
    expect(rows.map((r: any) => r.row_remarks)).toEqual(['B', 'A', 'A']);
    expect(rows[2].row_lab_tests_selected).toEqual([]);
    expect(rows[2].__m3_row_id).not.toBe('r1');
    expect(state.docs.a.form_values.test_charge_row_id).toBe('r1');
  });
  it('manual tolerance edits survive reopen and do not modify the release', async () => {
    const before = canonicalM3(release);
    const first = mount(); await ready(first.container);
    fireEvent.change(screen.getByRole('textbox', { name: 'Innenwandtoleranz' }), { target: { value: '+0,03/-0,07 mm' } });
    await save(); await waitFor(() => expect(state.docs.a.form_values.inner_wall_tolerance).toBe('+0,03/-0,07 mm'));
    first.unmount();
    state.releaseGet.mockResolvedValue({ ...release, inner_wall_tolerance: '±1 mm' });
    const second = mount(); await ready(second.container);
    expect(screen.getByRole('textbox', { name: 'Innenwandtoleranz' })).toHaveValue('+0,03/-0,07 mm');
    expect(canonicalM3(release)).toBe(before);
  });
  it('creation adds each row service only to its own sample; normal saves do not touch an existing order', async () => {
    state.docs.a = doc('a', { m3_rows: [{ volume_m3: '4', row_lab_tests_selected: ['Geo'] }, { volume_m3: '2', row_lab_tests_selected: [] }] });
    const view = mount(); await ready(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Beprobungsauftrag erstellen' }));
    await waitFor(() => expect(state.measurements).toHaveBeenCalledTimes(1));
    expect(state.measurements.mock.calls[0][0]).toEqual({ order_id: 'new-order', service_id: 'Geo', sample_id: '0020-6047-00340' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'm³-Liste speichern' })).not.toBeDisabled());
    await save();
    expect(state.measurements).toHaveBeenCalledTimes(1);
    expect(state.orders).toHaveBeenCalledTimes(1);
  });
  it('a missing row service prevents order, sample and task writes', async () => {
    state.docs.a = doc('a', { m3_rows: [{ volume_m3: '4', row_lab_tests_selected: ['missing'] }] });
    state.resolve.mockResolvedValue({ matched: [], missing: ['missing'] });
    const view = mount(); await ready(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Beprobungsauftrag erstellen' }));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(state.orders).not.toHaveBeenCalled();
    expect(state.samples).not.toHaveBeenCalled();
    expect(state.measurements).not.toHaveBeenCalled();
  });
});

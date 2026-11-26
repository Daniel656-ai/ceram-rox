import { describe, it, expect, vi } from 'vitest';
import { canonicalM3, initializeM3Tolerances, parseM3Decimal, validM3Tolerance, validateM3Inputs } from '../workingValues';
import { deriveM3Values, stripDerivedValues } from '../derive';
import { effectiveRowServices, planM3RowServices } from '../rowServices';
import { planM3Samples } from '../sampleNumber';
import { analyzeM3Retrofit } from '../retrofit';
import { matchSamplingCodes } from '@/lib/samplingCodeMap';
import { buildM3PdfModel, renderM3Pdf } from '../pdfExport';
import { buildM3PrintHtml } from '../printM3Html';
const constants = { crossSectionM: .15, pressureTestMm: 150, rsmMaxMm: 350, laborKatAddMm: 50, elementRounding: 10 };
const release = { length_mm: 520, length_tolerance: '+3/-2 mm', cross_section_tolerance: '±2 mm', inner_wall_tolerance: '+0,02/−0,05 mm' };
const derive = (stored: Record<string, unknown>, rel = release) => deriveM3Values({ stored, release: rel, orderNumber: null, constants }).values;

describe('m³ independent tolerance inputs', () => {
  it('copies only the three explicit release catalogue fields, without confusing nominal wall thickness', () => {
    const r = initializeM3Tolerances({}, { ...release, inner_wall_thickness_mm: .6, diameter_tolerance: 'wrong' }, 20);
    expect(r).toEqual({ length_tolerance: '+3/-2 mm', diameter_tolerance: '±2 mm', inner_wall_tolerance: '+0,02/−0,05 mm' });
  });
  it('preserves owned null/empty/edited inputs even if the release changes', () => {
    const r = initializeM3Tolerances({ length_tolerance: '', diameter_tolerance: null, inner_wall_tolerance: '+0,03/-0,06 mm' }, release, 40);
    expect(r).toEqual({ length_tolerance: '', diameter_tolerance: null, inner_wall_tolerance: '+0,03/-0,06 mm' });
  });
  it('leaves missing source values blank, with no calculated wall fallback', () => {
    expect(initializeM3Tolerances({}, {}, 40)).toEqual({ length_tolerance: '', diameter_tolerance: '', inner_wall_tolerance: '' });
  });
  it('materializes the historical explicit variant/free configuration once; direct values then win', () => {
    const old = initializeM3Tolerances({ tolerance_variant: 2, tolerance_free: true, tol_length_plus: '0,02', tol_length_minus: '0,05' }, release, 40);
    expect(old.length_tolerance).toBe('(+0,02/-0,05) [mm]');
    expect(old.diameter_tolerance).toBe('(+2/-2) [mm]');
    const edit = initializeM3Tolerances({ ...old, inner_wall_tolerance: '' }, { ...release, length_tolerance: 'changed' }, 20);
    expect(edit.length_tolerance).toBe(old.length_tolerance);
    expect(edit.inner_wall_tolerance).toBe('');
  });
  it('keeps the release immutable and persists direct tolerances through strip/reopen', () => {
    const before = canonicalM3(release);
    const values = stripDerivedValues(derive({ inner_wall_tolerance: '+0,04/-0,08 mm' }));
    const reopened = derive(values, { ...release, inner_wall_tolerance: '±1 mm' });
    expect(reopened.inner_wall_tolerance).toBe('+0,04/-0,08 mm');
    expect(values.length_tolerance).toBe('+3/-2 mm');
    expect(canonicalM3(release)).toBe(before);
  });
  it.each(['+0,02/−0,05 mm', '(+0.02/-0.05) [mm]', '±2 mm', '(+/-2) [mm]', '0,5', '', null])('accepts mm expression %s without numeric coercion', v => expect(validM3Tolerance(v)).toBe(true));
  it.each(['abc', '0,02 cm', '+/-', '1,2,3', '+0,02/-', 'NaN'])('rejects invalid expression %s', v => expect(validM3Tolerance(v)).toBe(false));
  it('invalid changed tolerance blocks saving, preserving raw input', () => {
    const values = { inner_wall_tolerance: 'invalid' };
    expect(() => validateM3Inputs(values)).toThrow(/Innenwand/);
    expect(values.inner_wall_tolerance).toBe('invalid');
  });
});

describe('m³ decimal editing and calculated identity', () => {
  it.each([['1,5', 1.5], ['1.5', 1.5], ['4', 4], ['1,', 1], ['.5', .5]])('parses %s as %s', (v, n) => expect(parseM3Decimal(v)).toBe(n));
  it.each(['', ' ', '-', '+', ',', 'abc', null, undefined])('never treats %s as zero', v => expect(parseM3Decimal(v)).toBeNull());
  it('saves the first 4 m³ row and re-derives 00340; numeric displays are never stored', () => {
    const saved = stripDerivedValues(derive({ m3_rows: [{ volume_m3: '4', row_remarks: 'A\n<&>', row_lab_tests_selected: [] }] }));
    expect(saved.m3_rows).toEqual([{ volume_m3: '4', row_remarks: 'A\n<&>', row_lab_tests_selected: [] }]);
    expect((derive(saved).m3_rows as Record<string, unknown>[])[0].element_number).toBe('00340');
  });
  it('preserves multiple volumes and rejects unfinished states at save time', () => {
    const saved = stripDerivedValues(derive({ m3_rows: [{ volume_m3: '4' }, { volume_m3: '1,5' }] }));
    expect((saved.m3_rows as Record<string, unknown>[]).map(r => r.volume_m3)).toEqual(['4', '1,5']);
    expect(() => validateM3Inputs({ m3_rows: [{ volume_m3: '-' }] })).toThrow(/Zeile 1/);
  });
});

describe('m³ full service replacement and TEST sample planning', () => {
  const catalog = [{ id: 'geo', service_name: 'Geometrievermessung' }, { id: 'nox', service_name: 'NOX-Messung' }];
  it.each([{}, { row_lab_tests_selected: null }])('missing/null inherit central standard', row => expect(effectiveRowServices(row, ['Geo'])).toEqual(['Geo']));
  it('explicit empty remains empty, override replaces rather than augments and deduplicates', () => {
    expect(effectiveRowServices({ row_lab_tests_selected: [] }, ['Geo'])).toEqual([]);
    expect(effectiveRowServices({ row_lab_tests_selected: ['NOx', 'nox'] }, ['Geo'])).toEqual(['NOx']);
  });
  it('a changed standard affects only inheriting rows', () => {
    expect(effectiveRowServices({}, ['NOx'])).toEqual(['NOx']);
    expect(effectiveRowServices({ row_lab_tests_selected: ['Geo'] }, ['NOx'])).toEqual(['Geo']);
  });
  it('plans exact services per generated sample; excluded TEST rows receive no services', async () => {
    const rows = [{ element_number: '00340' }, { element_number: '00400', row_lab_tests_selected: ['NOx'] }, { element_number: '00500', row_lab_tests_selected: [] }];
    const samplePlan = planM3Samples('0020-6047-125', rows, { status: 'ok', rowIndices: [1, 2] });
    const plan = await planM3RowServices(samplePlan, rows, ['Geo'], async codes => matchSamplingCodes(codes, catalog));
    expect(plan.map(p => [p.sampleNumber, p.services.map(s => s.id)])).toEqual([['0020-6047-00400', ['nox']], ['0020-6047-00500', []]]);
  });
  it('rejects any missing/inactive selection before a caller can create an order', async () => {
    const rows = [{ element_number: '00340', row_lab_tests_selected: ['missing'] }];
    const create = vi.fn();
    await expect(planM3RowServices(planM3Samples('0020-6047', rows, { status: 'none', rowIndices: [] }), rows, [], async codes => matchSamplingCodes(codes, catalog)).then(create)).rejects.toThrow(/missing/);
    expect(create).not.toHaveBeenCalled();
  });
  it('does not accept half a legacy Bench mapping', async () => {
    const rows = [{ element_number: '00340' }];
    await expect(planM3RowServices(planM3Samples('0020-6047', rows, { status: 'none', rowIndices: [] }), rows, ['Bench'], async codes => matchSamplingCodes(codes, [{ id: 'bench', service_name: 'BENCH NOx' }]))).rejects.toThrow(/Bench/);
  });
  it('does not reject deduplicated Bench overlap when both services exist', async () => {
    const rows = [{ element_number: '00340' }];
    const plan = await planM3RowServices(planM3Samples('0020-6047', rows, { status: 'none', rowIndices: [] }), rows, ['Bench NOx', 'Bench'], async codes => matchSamplingCodes(codes, [{ id: 'bn', service_name: 'BENCH NOx' }, { id: 'bs', service_name: 'BENCH SOx' }]));
    expect(plan[0].services.map(m => m.id)).toEqual(['bn', 'bs']);
  });
  it.each([[[]], [['Geo']]])('retrofit blocks overrides %j with an entirely empty write plan', override => {
    const r = analyzeM3Retrofit({ orderId: 'order', orderStatus: 'open', articleNumber: '0020-6047', rows: [{ element_number: '00340', row_lab_tests_selected: override }], marking: { status: 'none', rowIndices: [] }, linkedSamples: [], samplesByNumber: [], measurements: [] });
    expect(r.status).toBe('review');
    expect(r.plan).toEqual({ samples: [], links: [], assignments: [], new_tasks: [] });
  });
});

describe('m³ shared print details and preserved tolerances', () => {
  it('keeps per-row remarks and explicit no-service override only on its owning print row', () => {
    const model = buildM3PdfModel(derive({ m3_rows: [{ volume_m3: '4', row_remarks: '<script>\nA & B', row_lab_tests_selected: [] }, { volume_m3: '1' }] }), { notices: [], testRowIndices: [0] });
    expect(model.rows[0].remarks).toBe('<script>\nA & B');
    expect(model.rows[0].servicesNote).toContain('keine');
    expect(model.rows[1].remarks).toBe('');
    expect(model.rows[1].servicesNote).toBeNull();
    expect(model.calc.slice(0, 3).map(x => x[1])).toEqual(['+3/-2 mm', '±2 mm', '+0,02/−0,05 mm']);
    const html = buildM3PrintHtml(model);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('PDF supports long multiline remarks over several A4 pages', () => {
    const model = buildM3PdfModel(derive({ m3_rows: [{ volume_m3: 4, row_remarks: ('Long remark with special characters & < > and text.\n').repeat(100) }] }), { notices: [] });
    expect(renderM3Pdf(model).getNumberOfPages()).toBeGreaterThan(2);
  });
});

import { useState } from 'react';
import { Settings2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { effectiveRowServices, hasRowServiceOverride, ROW_SERVICES_KEY } from '@/lib/m3List/rowServices';
import { selectableSamplingCodes, toggleSamplingCode, normalizeSamplingKey } from '@/lib/samplingCodeMap';

export default function M3RowDetails({ row, index, standard, dynamicCodes, readonly, onPatch }: {
  row: Record<string, unknown>; index: number; standard: string[]; dynamicCodes: (string | null)[];
  readonly: boolean; onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const override = hasRowServiceOverride(row);
  let effective: string[] = [];
  try { effective = effectiveRowServices(row, standard); } catch { /* malformed legacy value stays visible, never silently saved */ }
  return <div className="mt-3 space-y-2 border-t pt-2">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className={override ? 'font-semibold text-primary' : 'text-muted-foreground'}>
        {override ? `Individuelle Messungen: ${effective.join(', ') || 'keine'}` : 'Standardmessungen'}
      </span>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={readonly}
        title={`Messungen für m³-Zeile ${index + 1} bearbeiten`} aria-label={`Messungen für m³-Zeile ${index + 1} bearbeiten`}
        onClick={() => { setSelection(effective); setOpen(true); }}><Settings2 className="h-4 w-4" /></Button>
      {override && <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={readonly}
        title="Standardmessungen übernehmen" aria-label="Standardmessungen übernehmen"
        onClick={() => onPatch({ [ROW_SERVICES_KEY]: null })}><RotateCcw className="h-4 w-4" /></Button>}
    </div>
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span>Bemerkung · m³-Zeile {index + 1}</span>
      <Textarea rows={2} disabled={readonly} value={String(row.row_remarks ?? '')}
        onChange={e => onPatch({ row_remarks: e.target.value })} />
    </label>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Messungen · m³-Zeile {index + 1}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto">
          {Array.from(new Set([...selectableSamplingCodes(selection, dynamicCodes), ...selection])).map(code =>
            <label key={code} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selection.some(c => normalizeSamplingKey(c) === normalizeSamplingKey(code))}
                onCheckedChange={checked => setSelection(prev => toggleSamplingCode(prev, code, checked === true))} />
              <span className="break-words">{code}</span>
            </label>)}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={() => { onPatch({ [ROW_SERVICES_KEY]: null }); setOpen(false); }}>Standard übernehmen</Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={() => { onPatch({ [ROW_SERVICES_KEY]: selection }); setOpen(false); }}>Übernehmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

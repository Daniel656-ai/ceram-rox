import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import {
  activeFilterChips,
  countSecondaryActive,
  EMPTY_RESULTS_FILTERS,
  type ResultsFilters,
} from "@/lib/results/resultsFilters";

interface Props {
  filters: ResultsFilters;
  onChange: (patch: Partial<ResultsFilters>) => void;
  services: string[];
  projects: string[];
  creators: string[];
  technicians: string[];
  conditionDimensions: { key: string; values: string[] }[];
}

/**
 * Kompakte Filterleiste der Ergebnisdatenbank: Suche, Messart, Projekt und
 * Proben-ID sind immer sichtbar; alle übrigen Filter liegen hinter
 * „Weitere Filter“. Aktive Filter erscheinen als einzeln entfernbare Chips.
 */
export default function ResultsFilterBar({
  filters,
  onChange,
  services,
  projects,
  creators,
  technicians,
  conditionDimensions,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const chips = activeFilterChips(filters);
  const secondaryCount = countSecondaryActive(filters);
  const conditionValues = conditionDimensions.find((d) => d.key === filters.conditionKey)?.values ?? [];

  return (
    <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Volltextsuche"
            placeholder="Volltextsuche…"
            value={filters.searchText}
            onChange={(e) => onChange({ searchText: e.target.value })}
            className="h-9 pl-9"
          />
        </div>
        <Select value={filters.serviceFilter} onValueChange={(v) => onChange({ serviceFilter: v })}>
          <SelectTrigger className="h-9 w-[170px]" aria-label="Messart"><SelectValue placeholder="Messart" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Messarten</SelectItem>
            {services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.projectFilter} onValueChange={(v) => onChange({ projectFilter: v })}>
          <SelectTrigger className="h-9 w-[170px]" aria-label="Projekt"><SelectValue placeholder="Projekt" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Projekte</SelectItem>
            {projects.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          aria-label="Proben-ID"
          placeholder="Proben-ID…"
          value={filters.sampleFilter}
          onChange={(e) => onChange({ sampleFilter: e.target.value })}
          className="h-9 w-[140px]"
        />
        <Button
          variant={moreOpen ? "secondary" : "outline"}
          size="sm"
          className="h-9"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
        >
          <SlidersHorizontal className="mr-1 h-4 w-4" />
          Weitere Filter
          {secondaryCount > 0 && (
            <Badge variant="default" className="ml-1.5 h-5 px-1.5 text-[10px]">{secondaryCount}</Badge>
          )}
          <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
        </Button>
        {chips.length > 0 && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange(EMPTY_RESULTS_FILTERS)}>
            <X className="mr-1 h-4 w-4" /> Zurücksetzen
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftraggeber</Label>
            <Select value={filters.creatorFilter} onValueChange={(v) => onChange({ creatorFilter: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Auftraggeber" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Auftraggeber</SelectItem>
                {creators.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Messdienstleister</Label>
            <Select value={filters.technicianFilter} onValueChange={(v) => onChange({ technicianFilter: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Messdienstleister" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Messdienstleister</SelectItem>
                {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {conditionDimensions.length > 0 && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ergebnismerkmal</Label>
                <Select
                  value={filters.conditionKey}
                  onValueChange={(v) => onChange({ conditionKey: v, conditionValue: "all" })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Ergebnismerkmal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Ergebnismerkmale</SelectItem>
                    {conditionDimensions.map((d) => <SelectItem key={d.key} value={d.key}>{d.key}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Wert des Merkmals</Label>
                <Select
                  value={filters.conditionValue}
                  onValueChange={(v) => onChange({ conditionValue: v })}
                  disabled={filters.conditionKey === "all"}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Wert" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Werte</SelectItem>
                    {conditionValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Abgeschlossen ab</Label>
            <Input type="date" className="h-9" value={filters.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Abgeschlossen bis</Label>
            <Input type="date" className="h-9" value={filters.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
          </div>
        </div>
      </CollapsibleContent>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Aktive Filter">
          <span className="text-xs text-muted-foreground">Aktiv:</span>
          {chips.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pl-2.5 pr-1 text-xs"
            >
              {c.label}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Filter ${c.label} entfernen`}
                onClick={() => onChange(c.reset)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Collapsible>
  );
}

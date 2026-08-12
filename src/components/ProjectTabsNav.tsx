import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ProjectTabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

interface ProjectTabsNavProps {
  active: string;
  onChange: (value: string) => void;
  mainTabs: ProjectTabItem[];
  advancedTabs: ProjectTabItem[];
  advancedLabel?: string;
}

/**
 * Einzeilige Projekt-Navigation: Hauptbereiche als Tabs, alle weiteren
 * Bereiche gebündelt in einem 2-spaltigen Popover ("Erweiterte Funktionen").
 * Erzeugt niemals horizontalen Overflow auf Seiten-/App-Ebene.
 */
export function ProjectTabsNav({
  active,
  onChange,
  mainTabs,
  advancedTabs,
  advancedLabel = "Erweiterte Funktionen",
}: ProjectTabsNavProps) {
  const [open, setOpen] = useState(false);
  const advancedActive = advancedTabs.some((t) => t.value === active);

  // Zeilenweise Anordnung: links/rechts abwechselnd
  const half = Math.ceil(advancedTabs.length / 2);
  const left = advancedTabs.slice(0, half);
  const right = advancedTabs.slice(half);
  const rows = left.map((l, i) => [l, right[i]] as [ProjectTabItem, ProjectTabItem | undefined]);

  return (
    <div className="print:hidden w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
      <TabsList className="flex w-max min-w-0 flex-nowrap items-center gap-0.5">
        {mainTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 whitespace-nowrap">
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}

        {advancedTabs.length > 0 && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  advancedActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{advancedLabel}</span>
                {open ? (
                  <ChevronUp className="h-3.5 w-3.5 opacity-70" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={12}
              className="z-50 w-[min(28rem,calc(100vw-2rem))] p-2"
            >
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {rows.map(([l, r], i) => (
                  <div key={i} className="contents">
                    <AdvancedItem item={l} active={active} onSelect={(v) => { onChange(v); setOpen(false); }} />
                    {r ? (
                      <AdvancedItem item={r} active={active} onSelect={(v) => { onChange(v); setOpen(false); }} />
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </TabsList>
    </div>
  );
}

function AdvancedItem({
  item,
  active,
  onSelect,
}: {
  item: ProjectTabItem;
  active: string;
  onSelect: (value: string) => void;
}) {
  const isActive = item.value === active;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-foreground hover:bg-muted",
      )}
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </button>
  );
}

import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import MasterDataSection from "@/components/ServiceDesigner/MasterDataSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GlobalList } from "@/lib/api/globalLibrary";

/**
 * Zentraler Navigationsbereich „Stammdaten“.
 *
 * Es wird bewusst keine neue Stammdatenverwaltung entwickelt – die Seite nutzt
 * die vorhandene Verwaltung (globale Listen inkl. frei definierbarer
 * Eigenschaften). Neue Kategorien erscheinen automatisch in Navigation und
 * Übersicht, ohne Codeanpassung.
 */
export default function MasterDataPage() {
  const { listKey } = useParams<{ listKey?: string }>();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["global-lists"],
    queryFn: () => api.globalLists.list(),
  });

  const current = useMemo(
    () => lists.find((l: GlobalList) => l.list_key === listKey) ?? null,
    [lists, listKey]
  );

  if (listKey) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {current?.display_name ?? "Stammdaten"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {current?.description ||
              "Stammdatensätze und deren Eigenschaften – zentrale Datenquelle für Formulare, Berechnungen und Berichte."}
          </p>
        </div>
        {!isLoading && !current ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Diese Stammdaten-Kategorie existiert nicht (mehr).
            </CardContent>
          </Card>
        ) : (
          <MasterDataSection focusListKey={listKey} showCategoryList={false} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stammdaten</h1>
        <p className="text-sm text-muted-foreground">
          Objekte und deren Eigenschaften – z.&nbsp;B. Mundstücke, Öfen, Extruder.
          Neue Kategorien erscheinen automatisch in der Navigation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((l: GlobalList) => (
          <Link key={l.id} to={`/stammdaten/${l.list_key}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  {l.display_name}
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {l.list_key}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-sm text-muted-foreground">
                {l.description || "Stammdatensätze verwalten"}
              </CardContent>
            </Card>
          </Link>
        ))}
        {!isLoading && lists.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Noch keine Stammdaten-Kategorien angelegt.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Kategorien verwalten</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterDataSection />
        </CardContent>
      </Card>
    </div>
  );
}

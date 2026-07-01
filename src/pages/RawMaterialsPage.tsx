import { useState, useEffect } from "react";
import { useRawMaterials, useAddRawMaterial, useStorageLocations, useAddStorageLocation, useDeleteRawMaterial } from "@/hooks/useRawMaterials";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, MapPin, AlertTriangle, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";
import { useInventoryMovements } from "@/hooks/useRawMaterials";
import { useUsers } from "@/hooks/useUsers";
import { useTranslation } from "react-i18next";
import { HazardClassSelector } from "@/components/HazardClassSelector";
import { GhsPictogramList } from "@/components/GhsPictogram";
import { PsaSymbolSelector } from "@/components/PsaSymbolSelector";
import { PsaSymbolList } from "@/components/PsaSymbolList";
import type { HazardClassKey } from "@/lib/hazardClasses";
import { StorageLocationsManager } from "@/components/StorageLocationsManager";
import { ImportRawMaterialsDialog } from "@/components/ImportRawMaterialsDialog";
import { PersonSelect } from "@/components/PersonSelect";
import { formatQuantity } from "@/lib/formatQuantity";





function formatLocation(loc: any) {
  if (!loc) return "–";
  if (loc.name) return loc.name;
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ") || "–";
}


export default function RawMaterialsPage() {
  const { t } = useTranslation(["raw_materials", "common"]);
  const { role, user } = useAuth();
  const { data: materials, isLoading } = useRawMaterials();
  const { data: locations } = useStorageLocations();
  const { data: allMovements } = useInventoryMovements();
  const addMaterial = useAddRawMaterial();
  const addLocation = useAddStorageLocation();

  const prefsKey = `rawMaterials.listPrefs.${user?.id ?? "anon"}`;
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(prefsKey) || "{}"); } catch { return {}; }
  };
  const initialPrefs = loadPrefs();

  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterHazard, setFilterHazard] = useState<"all" | "hazardous" | "safe">(initialPrefs.filterHazard ?? "all");
  const [sortKey, setSortKey] = useState<"number" | "name" | "hazard">(initialPrefs.sortKey ?? "number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialPrefs.sortDir ?? "asc");
  const [open, setOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [otherDesignation, setOtherDesignation] = useState("");
  const [casNumber, setCasNumber] = useState("");
  const [mrsNumber, setMrsNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [desc, setDesc] = useState("");
  const [unit, setUnit] = useState("kg");
  const [locationId, setLocationId] = useState("");
  const [hazardCats, setHazardCats] = useState<HazardClassKey[]>([]);
  const [psaSymbols, setPsaSymbols] = useState<string[]>([]);
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const { data: users } = useUsers();


  const [lHall, setLHall] = useState("");
  const [lRoom, setLRoom] = useState("");
  const [lShelf, setLShelf] = useState("");
  const [lPos, setLPos] = useState("");

  const { hasPermission } = usePermissions();
  const canManage = role === "master" || hasPermission("raw_materials.manage");
  const deleteMaterial = useDeleteRawMaterial();



  const stockMap = new Map<string, number>();
  allMovements?.forEach((m) => {
    const cur = stockMap.get(m.raw_material_id) || 0;
    stockMap.set(m.raw_material_id, m.movement_type === "eingang" ? cur + Number(m.quantity) : cur - Number(m.quantity));
  });

  const suppliers = [...new Set(materials?.map((m) => m.supplier).filter(Boolean) || [])];

  const filtered = materials?.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.material_name.toLowerCase().includes(q) || (m.material_number || "").toLowerCase().includes(q) || ((m as any).cas_number || "").toLowerCase().includes(q) || ((m as any).mrs_number || "").toLowerCase().includes(q) || (m.supplier || "").toLowerCase().includes(q);
    const matchSupplier = !filterSupplier || m.supplier === filterSupplier;
    const matchLocation = !filterLocation || m.default_location_id === filterLocation;
    const isHaz = !!(m as any).is_hazardous || (((m as any).hazard_categories as string[] | null)?.length ?? 0) > 0;
    const matchHazard = filterHazard === "all" || (filterHazard === "hazardous" ? isHaz : !isHaz);
    return matchSearch && matchSupplier && matchLocation && matchHazard;
  });

  const sorted = filtered ? [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "hazard") {
      const ah = (!!(a as any).is_hazardous || (((a as any).hazard_categories as string[] | null)?.length ?? 0) > 0) ? 1 : 0;
      const bh = (!!(b as any).is_hazardous || (((b as any).hazard_categories as string[] | null)?.length ?? 0) > 0) ? 1 : 0;
      cmp = ah - bh;
      if (cmp === 0) cmp = (a.material_name || "").localeCompare(b.material_name || "", undefined, { numeric: true, sensitivity: "base" });
    } else {
      const av = (sortKey === "number" ? (a.material_number || "") : a.material_name) || "";
      const bv = (sortKey === "number" ? (b.material_number || "") : b.material_name) || "";
      cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
    }
    return sortDir === "asc" ? cmp : -cmp;
  }) : filtered;

  useEffect(() => {
    try { localStorage.setItem(prefsKey, JSON.stringify({ sortKey, sortDir, filterHazard })); } catch {}
  }, [prefsKey, sortKey, sortDir, filterHazard]);

  const toggleSort = (key: "number" | "name" | "hazard") => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ active }: { active: boolean }) =>
    !active ? <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />
    : sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" />
    : <ArrowDown className="h-3 w-3 inline ml-1" />;


  const handleAddMaterial = async () => {
    if (!name) { toast.error(t("raw_materials:name_required")); return; }
    // Duplicate name detection (case-insensitive)
    const dup = materials?.find((m) => m.material_name.toLowerCase() === name.trim().toLowerCase());
    if (dup) { toast.error(t("raw_materials:duplicate_name")); return; }
    try {
      await addMaterial.mutateAsync({ material_name: name, material_number: number.trim() || null, other_designation: otherDesignation.trim() || null, cas_number: casNumber.trim() || null, mrs_number: mrsNumber.trim() || null, supplier: supplier || undefined, description: desc || undefined, unit, default_location_id: locationId || undefined, is_hazardous: hazardCats.length > 0, hazard_categories: hazardCats, psa_symbols: psaSymbols, responsible_user_id: responsibleUserId || null });
      toast.success(t("raw_materials:material_created"));
      setOpen(false); setName(""); setNumber(""); setOtherDesignation(""); setCasNumber(""); setMrsNumber(""); setSupplier(""); setDesc(""); setUnit("kg"); setLocationId(""); setHazardCats([]); setPsaSymbols([]); setResponsibleUserId("");
    } catch (e: any) { toast.error(t("common:error"), { description: e.message }); }

  };

  const handleDeleteMaterial = async (id: string, label: string) => {
    try {
      await deleteMaterial.mutateAsync(id);
      toast.success(t("raw_materials:material_deleted", { name: label }));
    } catch (e: any) {
      toast.error(t("common:error"), { description: e.message });
    }
  };





  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("raw_materials:title")}</h1>
          <p className="text-muted-foreground">{t("raw_materials:subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/rohstoffe/scan">
            <Button size="sm" variant="outline"><ScanLine className="h-4 w-4 mr-1" />Scannen</Button>
          </Link>
          {canManage && (
            <>
              <StorageLocationsManager triggerLabel={t("raw_materials:new_location")} />
              <ImportRawMaterialsDialog />

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("raw_materials:new_material")}</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>{t("raw_materials:new_material_title")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{t("raw_materials:material_name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                      <div><Label>RK-Code</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t("raw_materials:material_number_placeholder")} /></div>
                    </div>
                    <div>
                      <Label>Sonstige Bezeichnung</Label>
                      <Input value={otherDesignation} onChange={(e) => setOtherDesignation(e.target.value)} placeholder="Genauere Beschreibung des Rohstoffs" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{t("raw_materials:cas_number")}</Label><Input value={casNumber} onChange={(e) => setCasNumber(e.target.value)} placeholder={t("raw_materials:cas_number_placeholder")} /></div>
                      <div><Label>{t("raw_materials:mrs_number")}</Label><Input value={mrsNumber} onChange={(e) => setMrsNumber(e.target.value)} placeholder={t("raw_materials:mrs_number_placeholder")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{t("common:supplier")}</Label><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
                      <div><Label>{t("common:unit")}</Label>
                        <Select value={unit} onValueChange={setUnit}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["kg", "g", "t", "Liter", "ml", "Stück"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>{t("raw_materials:location")}</Label>
                      <Select value={locationId} onValueChange={setLocationId}>
                        <SelectTrigger><SelectValue placeholder={t("raw_materials:select_location")} /></SelectTrigger>
                        <SelectContent>{locations?.map((l) => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Verantwortlicher</Label>
                      <PersonSelect
                        value={responsibleUserId || ""}
                        onValueChange={(v) => setResponsibleUserId(v)}
                        users={users as any[]}
                        allowClear
                        clearLabel="Kein Verantwortlicher"
                        placeholder="Verantwortlichen wählen"
                      />
                    </div>
                    <div><Label>Bemerkung</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>

                    <HazardClassSelector
                      value={hazardCats}
                      onChange={setHazardCats}
                      label="GHS-Gefahrensymbole"
                      idPrefix="new-haz"
                    />

                    <PsaSymbolSelector
                      value={psaSymbols}
                      onChange={setPsaSymbols}
                      label="PSA-Schutzausrüstung"
                      idPrefix="new-psa"
                    />

                    <Button onClick={handleAddMaterial} className="w-full" disabled={addMaterial.isPending}>{t("common:create")}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("raw_materials:search_placeholder")} className="pl-9" />
        </div>
        <Select value={filterSupplier} onValueChange={(v) => setFilterSupplier(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("common:supplier")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("raw_materials:all_suppliers")}</SelectItem>
            {suppliers.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={(v) => setFilterLocation(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={t("raw_materials:location")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("raw_materials:all_locations")}</SelectItem>
            {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterHazard} onValueChange={(v: "all" | "hazardous" | "safe") => setFilterHazard(v)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Rohstoffe</SelectItem>
            <SelectItem value="hazardous">Nur Gefahrstoffe</SelectItem>
            <SelectItem value="safe">Ohne Gefahrstoffe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("raw_materials:material_count")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{materials?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("raw_materials:supplier_count")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{suppliers.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("raw_materials:location_count")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{locations?.length || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><button type="button" onClick={() => toggleSort("number")} className="inline-flex items-center hover:text-foreground">RK-Code<SortIcon active={sortKey === "number"} /></button></TableHead>
                <TableHead><button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center hover:text-foreground">{t("raw_materials:name")}<SortIcon active={sortKey === "name"} /></button></TableHead>
                <TableHead>{t("common:supplier")}</TableHead>
                <TableHead>{t("raw_materials:location")}</TableHead>
                <TableHead><button type="button" onClick={() => toggleSort("hazard")} className="inline-flex items-center hover:text-foreground">{t("raw_materials:hazardous")}<SortIcon active={sortKey === "hazard"} /></button></TableHead>
                <TableHead className="text-right">{t("raw_materials:stock")}</TableHead>
                <TableHead className="text-right">{t("common:unit")}</TableHead>
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">{t("common:loading")}</TableCell></TableRow>
              ) : sorted?.length === 0 ? (
                <TableRow><TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">{t("raw_materials:no_materials")}</TableCell></TableRow>
              ) : (
                sorted?.map((m) => {
                  const stock = stockMap.get(m.id) || 0;
                  const hazards = ((m as any).hazard_categories as string[]) || [];
                  const psa = ((m as any).psa_symbols as string[]) || [];
                  const isHazardous = (m as any).is_hazardous;
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs"><Link to={`/rohstoffe/${m.id}`} className="text-primary hover:underline">{m.material_number || "—"}</Link></TableCell>
                      <TableCell className="font-medium"><Link to={`/rohstoffe/${m.id}`} className="hover:underline">{m.material_name}</Link></TableCell>
                      <TableCell>{m.supplier || "–"}</TableCell>
                      <TableCell className="text-xs">{formatLocation(m.storage_locations)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {hazards.length > 0 ? (
                            <GhsPictogramList hazardClasses={hazards} size="sm" max={5} />
                          ) : isHazardous ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{t("raw_materials:hazard_yes")}</Badge>
                          ) : !psa.length ? (
                            <span className="text-muted-foreground text-sm">–</span>
                          ) : null}
                          {psa.length > 0 && <PsaSymbolList psaSymbols={psa} size="sm" max={5} />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono"><Badge variant={stock <= 0 ? "destructive" : "secondary"}>{formatQuantity(stock)}</Badge></TableCell>
                      <TableCell className="text-right text-muted-foreground">{m.unit}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("raw_materials:delete_title")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("raw_materials:delete_description", { name: m.material_name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteMaterial(m.id, m.material_name)}>
                                  {t("common:delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

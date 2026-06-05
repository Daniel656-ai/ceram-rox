import { useState } from "react";
import { useRawMaterials, useAddRawMaterial, useStorageLocations, useAddStorageLocation } from "@/hooks/useRawMaterials";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Search, MapPin, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useInventoryMovements } from "@/hooks/useRawMaterials";
import { useTranslation } from "react-i18next";

const HAZARD_CATEGORIES = [
  "gesundheitsschaedlich", "toxisch", "reizend", "aetzend", "entzuendlich", "umweltgefaehrlich", "sonstiges",
] as const;


function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

export default function RawMaterialsPage() {
  const { t } = useTranslation(["raw_materials", "common"]);
  const { role } = useAuth();
  const { data: materials, isLoading } = useRawMaterials();
  const { data: locations } = useStorageLocations();
  const { data: allMovements } = useInventoryMovements();
  const addMaterial = useAddRawMaterial();
  const addLocation = useAddStorageLocation();

  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [open, setOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [desc, setDesc] = useState("");
  const [unit, setUnit] = useState("kg");
  const [locationId, setLocationId] = useState("");
  const [hazardCats, setHazardCats] = useState<string[]>([]);

  const [lHall, setLHall] = useState("");
  const [lRoom, setLRoom] = useState("");
  const [lShelf, setLShelf] = useState("");
  const [lPos, setLPos] = useState("");

  const canManage = role === "master" || role === "auftraggeber";

  const toggleHazard = (cat: string) => {
    setHazardCats((cs) => cs.includes(cat) ? cs.filter(c => c !== cat) : [...cs, cat]);
  };


  const stockMap = new Map<string, number>();
  allMovements?.forEach((m) => {
    const cur = stockMap.get(m.raw_material_id) || 0;
    stockMap.set(m.raw_material_id, m.movement_type === "eingang" ? cur + Number(m.quantity) : cur - Number(m.quantity));
  });

  const suppliers = [...new Set(materials?.map((m) => m.supplier).filter(Boolean) || [])];

  const filtered = materials?.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.material_name.toLowerCase().includes(q) || m.material_number.toLowerCase().includes(q) || (m.supplier || "").toLowerCase().includes(q);
    const matchSupplier = !filterSupplier || m.supplier === filterSupplier;
    const matchLocation = !filterLocation || m.default_location_id === filterLocation;
    return matchSearch && matchSupplier && matchLocation;
  });

  const handleAddMaterial = async () => {
    if (!name || !number) { toast.error(t("raw_materials:name_number_required")); return; }
    try {
      await addMaterial.mutateAsync({ material_name: name, material_number: number, supplier: supplier || undefined, description: desc || undefined, unit, default_location_id: locationId || undefined, is_hazardous: hazardCats.length > 0, hazard_categories: hazardCats });
      toast.success(t("raw_materials:material_created"));
      setOpen(false); setName(""); setNumber(""); setSupplier(""); setDesc(""); setUnit("kg"); setLocationId(""); setHazardCats([]);
    } catch (e: any) { toast.error(t("common:error"), { description: e.message }); }
  };

  const handleAddLocation = async () => {
    if (!lHall) { toast.error(t("raw_materials:hall_is_required")); return; }
    try {
      await addLocation.mutateAsync({ hall: lHall, room: lRoom || undefined, shelf: lShelf || undefined, position: lPos || undefined });
      toast.success(t("raw_materials:location_created"));
      setLocOpen(false); setLHall(""); setLRoom(""); setLShelf(""); setLPos("");
    } catch (e: any) { toast.error(t("common:error"), { description: e.message }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("raw_materials:title")}</h1>
          <p className="text-muted-foreground">{t("raw_materials:subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Dialog open={locOpen} onOpenChange={setLocOpen}>
                <DialogTrigger asChild><Button variant="outline" size="sm"><MapPin className="h-4 w-4 mr-1" />{t("raw_materials:new_location")}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("raw_materials:new_location_title")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>{t("raw_materials:hall_required")}</Label><Input value={lHall} onChange={(e) => setLHall(e.target.value)} placeholder={t("raw_materials:hall_placeholder")} /></div>
                    <div><Label>{t("raw_materials:room")}</Label><Input value={lRoom} onChange={(e) => setLRoom(e.target.value)} placeholder={t("raw_materials:room_placeholder")} /></div>
                    <div><Label>{t("raw_materials:shelf")}</Label><Input value={lShelf} onChange={(e) => setLShelf(e.target.value)} placeholder={t("raw_materials:shelf_placeholder")} /></div>
                    <div><Label>{t("raw_materials:position")}</Label><Input value={lPos} onChange={(e) => setLPos(e.target.value)} placeholder={t("raw_materials:position_placeholder")} /></div>
                    <Button onClick={handleAddLocation} className="w-full">{t("common:create")}</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("raw_materials:new_material")}</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>{t("raw_materials:new_material_title")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{t("raw_materials:material_name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                      <div><Label>{t("raw_materials:material_number")}</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t("raw_materials:material_number_placeholder")} /></div>
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
                    <div><Label>{t("common:description")}</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
                    <div className="space-y-2 rounded-md border p-3">
                      <Label className="font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-destructive" />{t("raw_materials:hazard_section")}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {HAZARD_CATEGORIES.map(cat => (
                          <div key={cat} className="flex items-center space-x-2">
                            <Checkbox id={`new-haz-${cat}`} checked={hazardCats.includes(cat)} onCheckedChange={() => toggleHazard(cat)} />
                            <Label htmlFor={`new-haz-${cat}`} className="text-sm font-normal cursor-pointer">{t(`raw_materials:hazard_${cat}`)}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
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
                <TableHead>{t("raw_materials:number")}</TableHead>
                <TableHead>{t("raw_materials:name")}</TableHead>
                <TableHead>{t("common:supplier")}</TableHead>
                <TableHead>{t("raw_materials:location")}</TableHead>
                <TableHead>{t("raw_materials:hazardous")}</TableHead>
                <TableHead className="text-right">{t("raw_materials:stock")}</TableHead>
                <TableHead className="text-right">{t("common:unit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common:loading")}</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("raw_materials:no_materials")}</TableCell></TableRow>
              ) : (
                filtered?.map((m) => {
                  const stock = stockMap.get(m.id) || 0;
                  const isHazardous = (m as any).is_hazardous;
                  return (
                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-xs"><Link to={`/rohstoffe/${m.id}`} className="text-primary hover:underline">{m.material_number}</Link></TableCell>
                      <TableCell className="font-medium"><Link to={`/rohstoffe/${m.id}`} className="hover:underline">{m.material_name}</Link></TableCell>
                      <TableCell>{m.supplier || "–"}</TableCell>
                      <TableCell className="text-xs">{formatLocation(m.storage_locations)}</TableCell>
                      <TableCell>{isHazardous ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{t("raw_materials:hazard_yes")}</Badge> : <span className="text-muted-foreground text-sm">–</span>}</TableCell>
                      <TableCell className="text-right font-mono"><Badge variant={stock <= 0 ? "destructive" : "secondary"}>{stock.toFixed(1)}</Badge></TableCell>
                      <TableCell className="text-right text-muted-foreground">{m.unit}</TableCell>
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

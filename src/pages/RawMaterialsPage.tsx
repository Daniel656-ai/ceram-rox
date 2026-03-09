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
import { toast } from "sonner";
import { Plus, Search, Package, MapPin, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { useInventoryMovements, calculateStock } from "@/hooks/useRawMaterials";

function formatLocation(loc: any) {
  if (!loc) return "–";
  const parts = [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean);
  return parts.join(" › ");
}

export default function RawMaterialsPage() {
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

  // New material form
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [desc, setDesc] = useState("");
  const [unit, setUnit] = useState("kg");
  const [locationId, setLocationId] = useState("");

  // New location form
  const [lHall, setLHall] = useState("");
  const [lRoom, setLRoom] = useState("");
  const [lShelf, setLShelf] = useState("");
  const [lPos, setLPos] = useState("");

  const canManage = role === "master" || role === "auftraggeber";

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
    if (!name || !number) { toast.error("Name und Nummer sind Pflicht"); return; }
    try {
      await addMaterial.mutateAsync({ material_name: name, material_number: number, supplier: supplier || undefined, description: desc || undefined, unit, default_location_id: locationId || undefined });
      toast.success("Rohstoff angelegt");
      setOpen(false);
      setName(""); setNumber(""); setSupplier(""); setDesc(""); setUnit("kg"); setLocationId("");
    } catch (e: any) { toast.error("Fehler", { description: e.message }); }
  };

  const handleAddLocation = async () => {
    if (!lHall) { toast.error("Halle ist Pflicht"); return; }
    try {
      await addLocation.mutateAsync({ hall: lHall, room: lRoom || undefined, shelf: lShelf || undefined, position: lPos || undefined });
      toast.success("Lagerort angelegt");
      setLocOpen(false);
      setLHall(""); setLRoom(""); setLShelf(""); setLPos("");
    } catch (e: any) { toast.error("Fehler", { description: e.message }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rohstoffe</h1>
          <p className="text-muted-foreground">Verwaltung von Rohstoffen, Chargen und Lagerbeständen</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Dialog open={locOpen} onOpenChange={setLocOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><MapPin className="h-4 w-4 mr-1" />Lagerort</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Neuer Lagerort</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Halle *</Label><Input value={lHall} onChange={(e) => setLHall(e.target.value)} placeholder="z.B. Halle 1" /></div>
                    <div><Label>Raum</Label><Input value={lRoom} onChange={(e) => setLRoom(e.target.value)} placeholder="z.B. Raum A" /></div>
                    <div><Label>Regal</Label><Input value={lShelf} onChange={(e) => setLShelf(e.target.value)} placeholder="z.B. Regal B" /></div>
                    <div><Label>Fach / Position</Label><Input value={lPos} onChange={(e) => setLPos(e.target.value)} placeholder="z.B. Fach 3" /></div>
                    <Button onClick={handleAddLocation} className="w-full">Anlegen</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Rohstoff anlegen</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Neuer Rohstoff</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                      <div><Label>Nummer *</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="z.B. RM-001" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Lieferant</Label><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
                      <div><Label>Einheit</Label>
                        <Select value={unit} onValueChange={setUnit}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["kg", "g", "t", "Liter", "ml", "Stück"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Lagerort</Label>
                      <Select value={locationId} onValueChange={setLocationId}>
                        <SelectTrigger><SelectValue placeholder="Lagerort wählen" /></SelectTrigger>
                        <SelectContent>
                          {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Beschreibung</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
                    <Button onClick={handleAddMaterial} className="w-full" disabled={addMaterial.isPending}>Anlegen</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche..." className="pl-9" />
        </div>
        <Select value={filterSupplier} onValueChange={(v) => setFilterSupplier(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Lieferant" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Lieferanten</SelectItem>
            {suppliers.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={(v) => setFilterLocation(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Lagerort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Lagerorte</SelectItem>
            {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rohstoffe</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{materials?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lieferanten</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{suppliers.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lagerorte</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{locations?.length || 0}</div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Lagerort</TableHead>
                <TableHead className="text-right">Bestand</TableHead>
                <TableHead className="text-right">Einheit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Rohstoffe gefunden</TableCell></TableRow>
              ) : (
                filtered?.map((m) => {
                  const stock = stockMap.get(m.id) || 0;
                  return (
                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">
                        <Link to={`/rohstoffe/${m.id}`} className="text-primary hover:underline">{m.material_number}</Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link to={`/rohstoffe/${m.id}`} className="hover:underline">{m.material_name}</Link>
                      </TableCell>
                      <TableCell>{m.supplier || "–"}</TableCell>
                      <TableCell className="text-xs">{formatLocation(m.storage_locations)}</TableCell>
                      <TableCell className="text-right font-mono">
                        <Badge variant={stock <= 0 ? "destructive" : "secondary"}>{stock.toFixed(1)}</Badge>
                      </TableCell>
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

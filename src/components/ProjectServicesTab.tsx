import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, Check, ChevronsUpDown, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ProjectServicesTab({ projectId, canEdit }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["project_services", projectId],
    queryFn: () => api.projectServices.list(projectId),
    enabled: !!projectId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["measurement_services_active"],
    queryFn: () => api.measurementServices.listActive(),
  });

  const createMut = useMutation({
    mutationFn: (service_id: string) =>
      api.projectServices.create({ project_id: projectId, service_id, booked_by: user!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_services", projectId] });
      toast.success("Dienstleistung gebucht");
      setOpen(false);
      setSelectedServiceId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.projectServices.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_services", projectId] });
      toast.success("Buchung entfernt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedService = (services as any[]).find((s) => s.id === selectedServiceId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Geplante Dienstleistungen
        </CardTitle>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Dienstleistung buchen</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dienstleistung buchen</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedService
                        ? `${selectedService.service_name} (${selectedService.category})`
                        : "Dienstleistung auswählen..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Suchen..." />
                      <CommandList>
                        <CommandEmpty>Keine Dienstleistung gefunden.</CommandEmpty>
                        <CommandGroup>
                          {(services as any[]).map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.service_name} ${s.category}`}
                              onSelect={() => {
                                setSelectedServiceId(s.id);
                                setSelectorOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedServiceId === s.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="flex-1">{s.service_name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{s.category}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button
                  onClick={() => selectedServiceId && createMut.mutate(selectedServiceId)}
                  disabled={!selectedServiceId || createMut.isPending}
                >
                  Buchen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dienstleistung</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Gebucht am</TableHead>
              {canEdit && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground">Lade...</TableCell></TableRow>
            ) : (bookings as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground py-8">Noch keine Dienstleistungen gebucht.</TableCell></TableRow>
            ) : (
              (bookings as any[]).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.measurement_services?.service_name || "–"}</TableCell>
                  <TableCell>{b.measurement_services?.category || "–"}</TableCell>
                  <TableCell>{new Date(b.booked_at).toLocaleString("de-DE")}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

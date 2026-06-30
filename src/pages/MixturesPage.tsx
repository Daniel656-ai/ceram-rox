import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, FlaskRound } from "lucide-react";
import { useMixtures, useAddMixture } from "@/hooks/useMixtures";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ChargenView } from "@/components/ChargenView";
import { usePermissions } from "@/hooks/usePermissions";

export default function MixturesPage() {
  const { t } = useTranslation(["mixtures", "common"]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "chargen" ? "chargen" : "rezepturen";
  const [tab, setTab] = useState<string>(initialTab);

  const { data: mixtures = [], isLoading } = useMixtures();
  const addMixture = useAddMixture();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"mischung" | "loesung">("mischung");
  const [unit, setUnit] = useState("kg");
  const [targetConcentration, setTargetConcentration] = useState("");

  const reset = () => {
    setName("");
    setNumber("");
    setDescription("");
    setCategory("mischung");
    setUnit("kg");
    setTargetConcentration("");
  };

  const handleTabChange = (v: string) => {
    setTab(v);
    const next = new URLSearchParams(searchParams);
    if (v === "chargen") next.set("tab", "chargen");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const m = await addMixture.mutateAsync({
        name: name.trim(),
        mixture_number: number.trim() || null,
        description: description.trim() || null,
        category,
        unit,
        target_concentration: targetConcentration.trim() || null,
      });
      setOpen(false);
      reset();
      navigate(`/mischungen/${m.id}`);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskRound className="h-6 w-6 text-primary" />
            {t("mixtures:title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("mixtures:subtitle")}
          </p>
        </div>
        {tab === "rezepturen" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("mixtures:new_mixture")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("mixtures:new_mixture")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("mixtures:name")} *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("mixtures:number")}</Label>
                    <Input value={number} onChange={(e) => setNumber(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("mixtures:category")}</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mischung">{t("mixtures:category_mischung")}</SelectItem>
                        <SelectItem value="loesung">{t("mixtures:category_loesung")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("mixtures:unit")}</Label>
                    <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("mixtures:target_concentration")}</Label>
                    <Input value={targetConcentration} onChange={(e) => setTargetConcentration(e.target.value)} placeholder="z. B. 37 % HCl" />
                  </div>
                </div>
                <div>
                  <Label>{t("mixtures:description")}</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t("mixtures:cancel")}
                </Button>
                <Button onClick={handleCreate} disabled={!name.trim() || addMixture.isPending}>
                  {t("mixtures:save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="rezepturen">Rezepturen</TabsTrigger>
          <TabsTrigger value="chargen">Chargen</TabsTrigger>
        </TabsList>

        <TabsContent value="rezepturen" className="mt-4">
          <Card>
            {isLoading ? (
              <div className="p-6 text-muted-foreground">…</div>
            ) : mixtures.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                {t("mixtures:no_mixtures")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("mixtures:name")}</TableHead>
                    <TableHead>{t("mixtures:number")}</TableHead>
                    <TableHead>{t("mixtures:category")}</TableHead>
                    <TableHead>{t("mixtures:unit")}</TableHead>
                    <TableHead>{t("mixtures:target_concentration")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mixtures.map((m: any) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/mischungen/${m.id}`)}
                    >
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.mixture_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t(`mixtures:category_${m.category}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell>{m.target_concentration || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="chargen" className="mt-4">
          <ChargenView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

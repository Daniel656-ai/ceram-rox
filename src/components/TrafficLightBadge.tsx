import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Circle } from "lucide-react";

const LIGHT_CONFIG: Record<string, { color: string; emoji: string }> = {
  green: { color: "text-green-500", emoji: "🟢" },
  yellow: { color: "text-yellow-500", emoji: "🟡" },
  red: { color: "text-red-500", emoji: "🔴" },
};

interface TrafficLightProps {
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

export function TrafficLightBadge({ value, editable, onChange }: TrafficLightProps) {
  const { t } = useTranslation("projects");
  const config = LIGHT_CONFIG[value] || LIGHT_CONFIG.green;

  if (editable && onChange) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40 h-8">
          <div className="flex items-center gap-2">
            <Circle className={`h-3 w-3 fill-current ${config.color}`} />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="green">
            <div className="flex items-center gap-2">🟢 {t("traffic_green")}</div>
          </SelectItem>
          <SelectItem value="yellow">
            <div className="flex items-center gap-2">🟡 {t("traffic_yellow")}</div>
          </SelectItem>
          <SelectItem value="red">
            <div className="flex items-center gap-2">🔴 {t("traffic_red")}</div>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm" title={t(`traffic_${value}`)}>
      <Circle className={`h-3 w-3 fill-current ${config.color}`} />
      <span className="text-xs">{t(`traffic_${value}`)}</span>
    </span>
  );
}

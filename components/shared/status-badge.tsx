import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type DisplayStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const styles: Record<DisplayStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-900",
  UPCOMING: "bg-sky-100 text-sky-950",
  EXPIRED: "bg-red-100 text-red-800",
  SUSPENDED: "bg-amber-100 text-amber-950",
};

export function StatusBadge({ status }: { status: string }) {
  const key = (status in styles ? status : "EXPIRED") as DisplayStatus;
  return <Badge className={cn("whitespace-nowrap", styles[key])}>{STATUS_LABELS[key] ?? status}</Badge>;
}

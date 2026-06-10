import { Badge } from "@/components/ui/badge";
import type { OpportunityStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  OpportunityStatus,
  { label: string; variant: "slate" | "blue" | "purple" | "yellow" | "green" | "red" }
> = {
  discovered: { label: "Discovered", variant: "slate" },
  reviewed: { label: "Reviewed", variant: "blue" },
  approved: { label: "Approved", variant: "purple" },
  executing: { label: "Executing", variant: "yellow" },
  launched: { label: "Launched", variant: "green" },
  tracking: { label: "Tracking", variant: "green" },
  rejected: { label: "Rejected", variant: "red" },
  archived: { label: "Archived", variant: "slate" },
};

export function StatusBadge({ status }: { status: OpportunityStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "slate" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

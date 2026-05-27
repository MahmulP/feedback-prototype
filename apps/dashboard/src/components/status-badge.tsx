import { CheckCircle2, CircleDashed, Archive } from "lucide-react";
import type { FeedbackStatus } from "@mahmulp/shared-types";

import { Badge } from "@/components/ui/badge";

const COPY: Record<FeedbackStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  open: { label: "Open", variant: "outline" },
  resolved: { label: "Resolved", variant: "default" },
  archived: { label: "Archived", variant: "secondary" },
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  const meta = COPY[status];
  const Icon = status === "resolved" ? CheckCircle2 : status === "archived" ? Archive : CircleDashed;
  return (
    <Badge variant={meta.variant} aria-label={`Status: ${meta.label}`}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}

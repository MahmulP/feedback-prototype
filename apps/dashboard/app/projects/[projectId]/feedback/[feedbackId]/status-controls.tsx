"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { FeedbackStatus } from "@mahmulp/shared-types";

import { Button } from "@/components/ui/button";
import { updateStatusAction } from "./actions";

const TRANSITIONS: Record<FeedbackStatus, { status: FeedbackStatus; label: string }[]> = {
  open: [
    { status: "resolved", label: "Mark resolved" },
    { status: "archived", label: "Archive" },
  ],
  resolved: [
    { status: "open", label: "Reopen" },
    { status: "archived", label: "Archive" },
  ],
  archived: [{ status: "open", label: "Reopen" }],
};

export function StatusControls({
  projectId,
  feedbackId,
  status,
}: {
  projectId: string;
  feedbackId: string;
  status: FeedbackStatus;
}) {
  const [pending, startTransition] = useTransition();
  const transitions = TRANSITIONS[status];

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((t) => (
        <Button
          key={t.status}
          type="button"
          size="sm"
          variant={t.status === "resolved" ? "default" : "outline"}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updateStatusAction(projectId, feedbackId, t.status);
              if (res.ok) {
                toast.success(`Status changed to ${t.status}.`);
              } else {
                toast.error(res.error ?? "Request failed");
              }
            })
          }
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}

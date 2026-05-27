"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { replyAction } from "./actions";

export function ReplyForm({
  projectId,
  feedbackId,
}: {
  projectId: string;
  feedbackId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await replyAction(projectId, feedbackId, formData);
      if (res.ok) {
        toast.success("Reply sent.");
        formRef.current?.reset();
      } else {
        toast.error(res.error ?? "Request failed");
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="authorName" className="text-xs font-medium text-muted-foreground">
            Your name
          </label>
          <Input
            id="authorName"
            name="authorName"
            required
            autoComplete="name"
            placeholder="Anita"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="authorEmail" className="text-xs font-medium text-muted-foreground">
            Email <span className="opacity-60">(optional)</span>
          </label>
          <Input
            id="authorEmail"
            name="authorEmail"
            type="email"
            autoComplete="email"
            placeholder="anita@example.com"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="body" className="text-xs font-medium text-muted-foreground">
          Reply
        </label>
        <Textarea id="body" name="body" rows={3} required placeholder="Type your reply..." />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Reply"}
        </Button>
      </div>
    </form>
  );
}

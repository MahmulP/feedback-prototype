import { AlertTriangle } from "lucide-react";

export function ApiOfflineBanner({ apiUrl }: { apiUrl: string }) {
  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div>
        <p className="font-medium text-destructive">API offline</p>
        <p className="text-muted-foreground">
          The dashboard could not reach the feedback API at <code className="font-mono">{apiUrl}</code>.
          Start the API process (<code className="font-mono">bun --filter @mahmulp/api dev</code>) and
          refresh.
        </p>
      </div>
    </div>
  );
}

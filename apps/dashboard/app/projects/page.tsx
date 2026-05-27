import Link from "next/link";

import { ApiOfflineBanner } from "@/components/api-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const health = await api.health();
  if (!health.ok) {
    return <ApiOfflineBanner apiUrl={publicEnv().NEXT_PUBLIC_FEEDBACK_API_URL} />;
  }

  const { items } = await api.listProjects();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every project that has received at least one feedback pin.
        </p>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Install the SDK in a prototype, point it at this API, and create a pin. The project will
              show up here on the next refresh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
{`import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: '${publicEnv().NEXT_PUBLIC_FEEDBACK_API_URL}',
  projectId: 'prototype-a',
})`}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((project) => (
            <li key={project.projectId}>
              <Link
                href={`/projects/${encodeURIComponent(project.projectId)}`}
                className="block rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="break-all font-mono text-sm font-medium">{project.projectId}</p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {project.openFeedback} open
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {project.totalFeedback} total
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

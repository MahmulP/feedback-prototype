import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const env = publicEnv();
  const { items } = await api.listProjects();

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each project gets its own SDK API key. Projects you own and projects shared with you
            both show up here.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" aria-hidden /> New project
          </Link>
        </Button>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-base font-semibold">No projects yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one and we'll generate an API key you can drop into your prototype.
          </p>
          <Button asChild className="mt-4">
            <Link href="/projects/new">
              <Plus className="size-4" aria-hidden /> Create your first project
            </Link>
          </Button>
          <pre className="mt-6 overflow-x-auto rounded-md bg-muted p-4 text-left text-xs">
{`import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: '${env.NEXT_PUBLIC_FEEDBACK_API_URL}',
  apiKey: 'mp_…', // shown once after you create a project
})`}
          </pre>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${encodeURIComponent(project.slug)}`}
                className="block rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{project.name}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {project.slug}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {project.openFeedback} open
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span>{project.totalFeedback} total</span>
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        project.role === "owner"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {project.role}
                    </span>
                  </span>
                  <ArrowRight className="size-4" aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import { Folder, Home, KeyRound, LogOut, Plus, Settings } from "lucide-react";

import { logoutAction } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

/**
 * Server-rendered sidebar. Lists the user's projects + global nav.
 * Hidden on the login page; visible everywhere else once authenticated.
 */
export async function Sidebar({ activeSlug }: { activeSlug?: string }) {
  const me = await api.me();
  const env = publicEnv();
  if (!me) return null;
  const { items: projects } = await api.listProjects();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <span
          aria-hidden
          className="inline-block h-6 w-6 rounded-md bg-primary"
          style={{ clipPath: "polygon(50% 0, 100% 35%, 80% 100%, 20% 100%, 0 35%)" }}
        />
        <Link href="/projects" className="text-sm font-semibold tracking-tight">
          {env.NEXT_PUBLIC_APP_NAME}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1 text-sm">
          <li>
            <Link
              href="/projects"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Home className="size-4" aria-hidden /> All projects
            </Link>
          </li>
        </ul>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Projects</span>
            <Link href="/projects/new" aria-label="New project" className="hover:text-foreground">
              <Plus className="size-3.5" aria-hidden />
            </Link>
          </div>
          <ul className="space-y-1 text-sm">
            {projects.length === 0 ? (
              <li className="px-3 py-1.5 text-xs italic text-muted-foreground">No projects yet</li>
            ) : (
              projects.map((p) => {
                const active = activeSlug === p.slug;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${encodeURIComponent(p.slug)}`}
                      className={[
                        "flex items-center justify-between gap-2 rounded-md px-3 py-2",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      ].join(" ")}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Folder className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{p.name}</span>
                      </span>
                      {p.openFeedback > 0 ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {p.openFeedback}
                        </span>
                      ) : null}
                    </Link>
                    {active ? (
                      <ul className="ml-7 mt-1 space-y-1 text-xs">
                        <li>
                          <Link
                            href={`/projects/${encodeURIComponent(p.slug)}/keys`}
                            className="flex items-center gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <KeyRound className="size-3.5" aria-hidden /> API keys
                          </Link>
                        </li>
                        <li>
                          <Link
                            href={`/projects/${encodeURIComponent(p.slug)}/settings`}
                            className="flex items-center gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Settings className="size-3.5" aria-hidden /> Settings
                          </Link>
                        </li>
                      </ul>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </nav>

      <div className="border-t px-3 py-3">
        <div className="mb-2 truncate px-2 text-xs text-muted-foreground" title={me.user.email}>
          {me.user.name} · <span className="opacity-70">{me.user.email}</span>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}

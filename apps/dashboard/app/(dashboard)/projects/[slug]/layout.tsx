import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, MessageSquare, Settings } from "lucide-react";

import { api } from "@/lib/api";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await api.getProject(slug);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
        <h1 className="break-all text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{project.slug}</p>
        {project.description ? (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        ) : null}
      </header>
      <nav className="flex gap-1 border-b">
        <ProjectTab href={`/projects/${encodeURIComponent(slug)}`} icon={MessageSquare}>
          Feedback
        </ProjectTab>
        <ProjectTab href={`/projects/${encodeURIComponent(slug)}/keys`} icon={KeyRound}>
          API keys
        </ProjectTab>
        <ProjectTab href={`/projects/${encodeURIComponent(slug)}/settings`} icon={Settings}>
          Settings
        </ProjectTab>
      </nav>
      {children}
    </div>
  );
}

function ProjectTab({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof KeyRound;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

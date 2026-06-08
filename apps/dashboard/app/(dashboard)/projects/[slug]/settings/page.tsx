import { notFound } from "next/navigation";

import { api } from "@/lib/api";

import { MembersControls } from "./members-controls";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await api.getProject(slug);
  if (!project) notFound();

  // Settings (edit, delete, sharing, keys) are owner-only.
  if (project.role !== "owner") {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        Only the project owner can change settings or manage sharing. You have{" "}
        <span className="font-medium capitalize text-foreground">{project.role}</span> access to this
        project.
      </div>
    );
  }

  const [me, membersRes] = await Promise.all([api.me(), api.listProjectMembers(slug)]);

  return (
    <div className="space-y-8">
      <SettingsForm
        slug={slug}
        initial={{
          name: project.name,
          ...(project.description !== undefined ? { description: project.description } : {}),
          allowedOrigins: project.allowedOrigins ?? [],
        }}
      />
      <MembersControls
        slug={slug}
        ownerEmail={me?.user.email ?? ""}
        members={membersRes.items}
      />
    </div>
  );
}

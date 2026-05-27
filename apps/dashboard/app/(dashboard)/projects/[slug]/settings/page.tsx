import { notFound } from "next/navigation";

import { api } from "@/lib/api";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await api.getProject(slug);
  if (!project) notFound();

  return (
    <SettingsForm
      slug={slug}
      initial={{
        name: project.name,
        ...(project.description !== undefined ? { description: project.description } : {}),
        allowedOrigins: project.allowedOrigins ?? [],
      }}
    />
  );
}

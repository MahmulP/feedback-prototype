import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

import { KeysControls } from "./keys-controls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function KeysPage({ params }: PageProps) {
  const { slug } = await params;
  const env = publicEnv();
  const { items } = await api.listProjectKeys(slug);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Each prototype that talks to this project needs an API key. Pass it as <code className="rounded bg-muted px-1 font-mono text-xs">apiKey</code> in <code className="rounded bg-muted px-1 font-mono text-xs">initFeedback</code>; the SDK sends it as <code className="rounded bg-muted px-1 font-mono text-xs">x-feedback-key</code>.
      </p>
      <KeysControls
        slug={slug}
        apiUrl={env.NEXT_PUBLIC_FEEDBACK_API_URL}
        keys={items.map((item) => ({
          id: item.id,
          prefix: item.prefix,
          createdAt: item.createdAt,
          ...(item.lastUsedAt !== undefined ? { lastUsedAt: item.lastUsedAt } : {}),
        }))}
      />
    </div>
  );
}

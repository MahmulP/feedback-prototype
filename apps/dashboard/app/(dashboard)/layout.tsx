import { Sidebar } from "@/components/sidebar";
import { ApiOfflineBanner } from "@/components/api-status";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const health = await api.health();
  const env = publicEnv();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          {!health.ok ? <ApiOfflineBanner apiUrl={env.NEXT_PUBLIC_FEEDBACK_API_URL} /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}

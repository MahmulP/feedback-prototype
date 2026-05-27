import Link from "next/link";

import { logoutAction } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { authConfigured, getSession } from "@/lib/session";

/**
 * Small server component rendered in the layout. Shows the signed-in email +
 * a logout button when authenticated, or a sign-in link when not.
 *
 * When auth is not configured at all (no ADMIN_EMAIL set) we hide the bar so
 * local dev doesn't fight the developer.
 */
export async function SessionBar() {
  if (!authConfigured()) return null;
  const session = await getSession();
  if (!session) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }
  return (
    <form action={logoutAction} className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">{session.email}</span>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}

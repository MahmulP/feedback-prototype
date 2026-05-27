import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewProjectForm } from "./new-project-form";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/projects">
          <ChevronLeft className="size-4" aria-hidden /> Back
        </Link>
      </Button>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>New project</CardTitle>
        </CardHeader>
        <CardContent>
          <NewProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}

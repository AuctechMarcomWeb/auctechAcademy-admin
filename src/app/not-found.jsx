import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center p-6">
      <Logo className="mb-8" />
      <p className="text-sm font-semibold uppercase tracking-wider text-secondary">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">This page doesn&apos;t exist in the admin portal.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href={ROUTES.admin.dashboard}>Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

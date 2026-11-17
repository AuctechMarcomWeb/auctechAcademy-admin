import { RouteGuard } from "@/components/layout/route-guard";
import { PortalShell } from "@/components/layout/portal-shell";

export const metadata = { title: "Admin Portal", robots: { index: false } };

export default function AdminLayout({ children }) {
  return (
    <RouteGuard role="admin">
      <PortalShell portal="admin" portalName="Admin Portal">
        {children}
      </PortalShell>
    </RouteGuard>
  );
}

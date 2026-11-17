"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Award, ExternalLink, Eye, RotateCcw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { DemoTag } from "@/components/shared/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { certificateService, normalizeCertificateId } from "@/services/certificate.service";
import { ApiError } from "@/services/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROUTES, siteHref } from "@/lib/constants";

export default function CertificatesAdminPage() {
  const certificates = useDb((s) => s.certificates);
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState(null);
  const [reason, setReason] = useState("");
  const revoke = useConfirm();
  const reinstate = useConfirm();

  const filter = useMemo(() => (c) => status === "all" || c.status === status, [status]);
  const valid = certificates.filter((c) => c.status === "valid").length;
  const verifications = certificates.reduce((a, c) => a + c.verificationHistory.length, 0);

  const doRevoke = async () => {
    if (reason.trim().length < 10) {
      toast.error("Give a reason of at least 10 characters.");
      return;
    }
    const c = revoke.payload;
    revoke.setBusy(true);
    try {
      await certificateService.revoke(c.id, reason.trim());
      toast.success(`Revoked ${c.id}`);
      revoke.close();
      setReason("");
      setDetail(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not revoke");
      revoke.setBusy(false);
    }
  };

  const doReinstate = async () => {
    const c = reinstate.payload;
    reinstate.setBusy(true);
    try {
      await certificateService.reinstate(c.id);
      toast.success(`Reinstated ${c.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not reinstate the certificate");
    } finally {
      reinstate.close();
    }
    setDetail(null);
  };

  const columns = [
    { id: "id", header: "Certificate ID", sortValue: (c) => c.id, cell: (c) => <code className="text-xs font-semibold">{c.id}</code> },
    { id: "student", header: "Student", sortValue: (c) => c.studentName, cell: (c) => c.studentName },
    { id: "course", header: "Course / programme", cell: (c) => <span className="text-sm line-clamp-1 max-w-[240px] block">{c.courseTitle}</span> },
    { id: "kind", header: "Type", cell: (c) => <Badge variant={c.kind === "internship" ? "accent" : "secondary"}>{c.kind}</Badge> },
    {
      id: "score",
      header: "Score",
      sortValue: (c) => c.finalScore,
      cell: (c) => <span className="tabular-nums">{c.finalScore}%</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      id: "issued",
      header: "Issued",
      sortValue: (c) => c.issuedAt,
      cell: (c) => <span className="text-sm whitespace-nowrap">{formatDate(c.issuedAt)}</span>,
    },
    {
      id: "verifications",
      header: "Checks",
      sortValue: (c) => c.verificationHistory.length,
      cell: (c) => <span className="tabular-nums">{c.verificationHistory.length}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { id: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <StatusBadge status={c.status} /> },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (c) => (
        <Button variant="ghost" size="sm" onClick={() => setDetail(c)}>
          <Eye /> Details
        </Button>
      ),
    },
  ];

  return (
    <AdminPage title="Certificates" description="Issued certificates, verification history and revocation controls.">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Valid certificates" value={valid} icon={Award} tone="success" />
        <StatCard label="Revoked" value={certificates.length - valid} icon={ShieldOff} tone="primary" />
        <StatCard label="Verification checks" value={verifications} icon={Eye} tone="secondary" hint="QR + web lookups" />
      </div>
      <DataTable
        rows={certificates}
        columns={columns}
        rowKey={(c) => c.id}
        searchable={(c) => `${normalizeCertificateId(c.id)} ${c.studentName} ${c.courseTitle}`}
        searchPlaceholder="Search by certificate ID, student or course…"
        filter={filter}
        initialSort={{ id: "issued", dir: "desc" }}
        onRowClick={setDetail}
        toolbar={
          <>
            <DemoTag />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36" aria-label="Status filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent size="lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-accent" /> {detail.id}
                </DialogTitle>
                <DialogDescription>{detail.courseTitle}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <StatusBadge status={detail.status} />
                <Badge variant="outline">{detail.kind}</Badge>
                <Button asChild variant="link" size="sm" className="ml-auto">
                  <Link href={siteHref(ROUTES.verifyCertificate(detail.id))} target="_blank">
                    <ExternalLink /> Public verification page
                  </Link>
                </Button>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Student</dt>
                <dd className="font-medium">{detail.studentName}</dd>
                <dt className="text-muted-foreground">Final score</dt>
                <dd>{detail.finalScore}%</dd>
                <dt className="text-muted-foreground">Completed</dt>
                <dd>{formatDate(detail.completedAt)}</dd>
                <dt className="text-muted-foreground">Issued</dt>
                <dd>{formatDate(detail.issuedAt)}</dd>
                {detail.status === "revoked" && (
                  <>
                    <dt className="text-muted-foreground">Revoked</dt>
                    <dd>{detail.revokedAt ? formatDateTime(detail.revokedAt) : "—"}</dd>
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd className="text-destructive">{detail.revokedReason}</dd>
                  </>
                )}
              </dl>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-2">Verification history ({detail.verificationHistory.length})</h4>
                {detail.verificationHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No verification lookups yet.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm max-h-48 overflow-y-auto scrollbar-thin">
                    {detail.verificationHistory.map((v) => (
                      <li key={v.id} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{formatDateTime(v.at)}</span>
                        <Badge variant="muted" className="uppercase">
                          {v.source}
                        </Badge>
                        <StatusBadge status={v.result === "not_found" ? "failed" : v.result} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                {detail.status === "valid" ? (
                  <Button variant="destructive" onClick={() => revoke.ask(detail)}>
                    <ShieldOff /> Revoke
                  </Button>
                ) : (
                  <Button onClick={() => reinstate.ask(detail)}>
                    <RotateCcw /> Reinstate
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revoke.open}
        onOpenChange={(o) => {
          revoke.onOpenChange(o);
          if (!o) setReason("");
        }}
        title="Revoke certificate?"
        description={`${revoke.payload?.id} will immediately show as revoked on the public verification page. This is recorded in the audit trail.`}
        confirmLabel="Revoke certificate"
        destructive
        loading={revoke.busy}
        onConfirm={doRevoke}
      >
        <FormField label="Reason" htmlFor="revoke-reason" required hint="Shown to anyone verifying the certificate.">
          <Textarea
            id="revoke-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Academic integrity violation confirmed during assessment audit."
          />
        </FormField>
      </ConfirmDialog>
      <ConfirmDialog
        open={reinstate.open}
        onOpenChange={reinstate.onOpenChange}
        title="Reinstate certificate?"
        description={`${reinstate.payload?.id} will become valid again and the revocation reason will be cleared.`}
        confirmLabel="Reinstate"
        loading={reinstate.busy}
        onConfirm={doReinstate}
      />
    </AdminPage>
  );
}

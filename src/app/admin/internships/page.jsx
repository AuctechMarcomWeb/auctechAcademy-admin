"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { InternshipFormDialog } from "@/components/admin/internship-form";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { internshipService } from "@/services/internship.service";
import { formatDate, formatINR } from "@/lib/format";
import { ROUTES, siteHref } from "@/lib/constants";

const STATUSES = ["applied", "shortlisted", "interview", "selected", "rejected", "active", "completed"];

export default function InternshipsAdminPage() {
  const internships = useDb((s) => s.internships);
  const applications = useDb((s) => s.internshipApplications);
  const users = useDb((s) => s.users);
  const [editing, setEditing] = useState();
  const [formOpen, setFormOpen] = useState(false);
  const [appFilter, setAppFilter] = useState("all");
  const confirm = useConfirm();
  const statusConfirm = useConfirm();

  const appCount = useMemo(() => {
    const m = {};
    applications.forEach((a) => (m[a.internshipId] = (m[a.internshipId] ?? 0) + 1));
    return m;
  }, [applications]);
  const internshipTitle = (id) => internships.find((i) => i.id === id)?.title ?? "—";
  const appFilterFn = useMemo(() => (a) => appFilter === "all" || a.internshipId === appFilter, [appFilter]);

  const remove = async () => {
    const i = confirm.payload;
    confirm.setBusy(true);
    try {
      await internshipService.remove(i.id);
      toast.success(`Deleted "${i.title}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the internship");
    } finally {
      confirm.close();
    }
  };

  const changeStatus = async () => {
    const { app, status } = statusConfirm.payload;
    statusConfirm.setBusy(true);
    const internship = internships.find((i) => i.id === app.internshipId);
    try {
      await internshipService.setApplicationStatus(
        app.id,
        status,
        status === "active" && internship ? { mentor: internship.mentorName } : status === "completed" ? { issueCertificate: true } : {},
      );
      toast.success(`${app.fullName} → ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the application");
    } finally {
      statusConfirm.close();
    }
  };

  const iColumns = [
    {
      id: "title",
      header: "Internship",
      sortValue: (i) => i.title,
      cell: (i) => (
        <div>
          <p className="font-medium">{i.title}</p>
          <p className="text-xs text-muted-foreground">
            {i.department} · {i.mentorName}
          </p>
        </div>
      ),
    },
    { id: "duration", header: "Duration", sortValue: (i) => i.durationWeeks, cell: (i) => `${i.durationWeeks} wks` },
    { id: "mode", header: "Mode", cell: (i) => i.workMode },
    { id: "stipend", header: "Stipend", cell: (i) => (i.stipend === "Paid" && i.stipendAmount ? `${formatINR(i.stipendAmount)}/mo` : i.stipend) },
    {
      id: "deadline",
      header: "Deadline",
      sortValue: (i) => i.applicationDeadline,
      cell: (i) => <span className="whitespace-nowrap text-sm">{formatDate(i.applicationDeadline)}</span>,
    },
    { id: "openings", header: "Openings", cell: (i) => i.openings, className: "text-right", headerClassName: "text-right" },
    {
      id: "apps",
      header: "Applications",
      sortValue: (i) => appCount[i.id] ?? 0,
      cell: (i) => <span className="tabular-nums">{appCount[i.id] ?? 0}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { id: "status", header: "Status", sortValue: (i) => i.status, cell: (i) => <StatusBadge status={i.status} /> },
    {
      id: "actions",
      header: "",
      className: "text-right whitespace-nowrap",
      cell: (i) => (
        <>
          <Button asChild variant="ghost" size="icon-sm" aria-label="View public page">
            <Link href={siteHref(ROUTES.internship(i.slug))} target="_blank">
              <ExternalLink />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit"
            onClick={() => {
              setEditing(i);
              setFormOpen(true);
            }}
          >
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete" className="text-destructive" onClick={() => confirm.ask(i)}>
            <Trash2 />
          </Button>
        </>
      ),
    },
  ];

  const aColumns = [
    {
      id: "applicant",
      header: "Applicant",
      sortValue: (a) => a.fullName,
      cell: (a) => (
        <div>
          <p className="font-medium">{a.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {a.email} · {a.college}
          </p>
        </div>
      ),
    },
    {
      id: "internship",
      header: "Internship",
      cell: (a) => <span className="text-sm line-clamp-1 max-w-[220px] block">{internshipTitle(a.internshipId)}</span>,
    },
    {
      id: "applied",
      header: "Applied",
      sortValue: (a) => a.appliedAt,
      cell: (a) => <span className="text-sm whitespace-nowrap">{formatDate(a.appliedAt)}</span>,
    },
    { id: "mentor", header: "Mentor", cell: (a) => a.mentor ?? <span className="text-muted-foreground">—</span> },
    {
      id: "perf",
      header: "Performance",
      cell: (a) =>
        typeof a.performanceScore === "number" ? (
          <Badge variant="success">{a.performanceScore}%</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (a) => a.status,
      cell: (a) => (
        <Select value={a.status} onValueChange={(v) => statusConfirm.ask({ app: a, status: v })}>
          <SelectTrigger className="h-8 w-36" aria-label={`Status for ${a.fullName}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "user",
      header: "Account",
      cell: (a) => <span className="text-xs text-muted-foreground">{users.find((u) => u.id === a.userId)?.email ?? "—"}</span>,
    },
  ];

  return (
    <AdminPage
      title="Internships"
      description="Manage internship listings and move applicants through the pipeline."
      actions={
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus /> Create internship
        </Button>
      }
    >
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Listings ({internships.length})</TabsTrigger>
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="listings">
          <DataTable
            rows={internships}
            columns={iColumns}
            rowKey={(i) => i.id}
            searchable={(i) => `${i.title} ${i.department} ${i.mentorName}`}
            searchPlaceholder="Search internships…"
          />
        </TabsContent>
        <TabsContent value="applications">
          <DataTable
            rows={applications}
            columns={aColumns}
            rowKey={(a) => a.id}
            searchable={(a) => `${a.fullName} ${a.email} ${a.college} ${internshipTitle(a.internshipId)}`}
            searchPlaceholder="Search applicants…"
            filter={appFilterFn}
            initialSort={{ id: "applied", dir: "desc" }}
            toolbar={
              <Select value={appFilter} onValueChange={setAppFilter}>
                <SelectTrigger className="w-60" aria-label="Internship filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All internships</SelectItem>
                  {internships.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </TabsContent>
      </Tabs>

      <InternshipFormDialog internship={editing} open={formOpen} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title="Delete internship?"
        description={`"${confirm.payload?.title}" will be removed from the listings. Existing applications are kept.`}
        confirmLabel="Delete"
        destructive
        loading={confirm.busy}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={statusConfirm.open}
        onOpenChange={statusConfirm.onOpenChange}
        title="Update application status?"
        description={
          statusConfirm.payload
            ? `Move ${statusConfirm.payload.app.fullName} to "${statusConfirm.payload.status}". ${statusConfirm.payload.status === "active" ? "The internship mentor will be assigned automatically." : "The applicant will be notified."}`
            : ""
        }
        confirmLabel="Update"
        loading={statusConfirm.busy}
        onConfirm={changeStatus}
      />
    </AdminPage>
  );
}

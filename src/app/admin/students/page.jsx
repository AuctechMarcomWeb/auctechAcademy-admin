"use client";

import { useMemo, useState } from "react";
import { Ban, Eye, MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { UserAvatar } from "@/components/shared/user-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { useLearning } from "@/store/learning.store";
import { adminService } from "@/services/admin.service";
import { formatDate, formatINR, timeAgo } from "@/lib/format";
import { flattenCurriculum } from "@/lib/curriculum";

export default function StudentsPage() {
  const users = useDb((s) => s.users);
  const enrollments = useDb((s) => s.enrollments);
  const orders = useDb((s) => s.orders);
  const certificates = useDb((s) => s.certificates);
  const courses = useDb((s) => s.courses);
  const quizzes = useDb((s) => s.quizzes);
  const assignments = useDb((s) => s.assignments);
  const progressMap = useLearning((s) => s.progress);
  const attempts = useLearning((s) => s.attempts);
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState(null);
  const confirm = useConfirm();

  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);
  const enrollCount = useMemo(() => {
    const m = {};
    enrollments.forEach((e) => e.status !== "refunded" && (m[e.userId] = (m[e.userId] ?? 0) + 1));
    return m;
  }, [enrollments]);
  const filter = useMemo(() => (u) => status === "all" || u.status === status, [status]);

  const toggleStatus = async () => {
    const u = confirm.payload;
    confirm.setBusy(true);
    const next = u.status === "active" ? "suspended" : "active";
    try {
      await adminService.setUserStatus(u.id, next);
      toast.success(`${u.name} ${next === "active" ? "reactivated" : "suspended"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the account");
    }
    confirm.close();
  };

  const progressFor = (userId, courseId) => {
    const course = courses.find((c) => c.id === courseId);
    const progress = progressMap[`${userId}:${courseId}`];
    if (!course) return null;
    const items = flattenCurriculum(
      course,
      quizzes.filter((q) => q.courseId === courseId),
      assignments.filter((a) => a.courseId === courseId),
    );
    const done = items.filter((i) =>
      i.kind === "lesson" ? progress?.lessons[i.id]?.completed : i.kind === "quiz" ? attempts.some((a) => a.quizId === i.id && a.passed) : false,
    ).length;
    return items.length ? Math.round((done / items.length) * 100) : 0;
  };

  const columns = [
    {
      id: "name",
      header: "Student",
      sortValue: (u) => u.name,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={u.name} src={u.avatarUrl} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="font-medium">{u.name}</p>
            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    { id: "location", header: "Location", sortValue: (u) => u.location ?? "", cell: (u) => <span className="text-sm">{u.location ?? "—"}</span> },
    {
      id: "joined",
      header: "Joined",
      sortValue: (u) => u.joinedAt,
      cell: (u) => <span className="text-sm whitespace-nowrap">{formatDate(u.joinedAt)}</span>,
    },
    {
      id: "active",
      header: "Last active",
      sortValue: (u) => u.lastActiveAt ?? "",
      cell: (u) => <span className="text-sm text-muted-foreground whitespace-nowrap">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "—"}</span>,
    },
    {
      id: "enrollments",
      header: "Enrollments",
      sortValue: (u) => enrollCount[u.id] ?? 0,
      cell: (u) => <span className="tabular-nums">{enrollCount[u.id] ?? 0}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { id: "status", header: "Status", sortValue: (u) => u.status, cell: (u) => <StatusBadge status={u.status} /> },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDetail(u)}>
              <Eye /> View details
            </DropdownMenuItem>
            {u.status === "active" ? (
              <DropdownMenuItem destructive onSelect={() => confirm.ask(u)}>
                <Ban /> Suspend
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => confirm.ask(u)}>
                <RotateCcw /> Reactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const detailEnrollments = detail ? enrollments.filter((e) => e.userId === detail.id) : [];
  const detailOrders = detail ? orders.filter((o) => o.userId === detail.id) : [];
  const detailCerts = detail ? certificates.filter((c) => c.userId === detail.id) : [];

  return (
    <AdminPage title="Students" description={`${students.length} registered learners.`}>
      <DataTable
        rows={students}
        columns={columns}
        rowKey={(u) => u.id}
        searchable={(u) => `${u.name} ${u.email} ${u.location ?? ""}`}
        searchPlaceholder="Search by name or email…"
        filter={filter}
        initialSort={{ id: "joined", dir: "desc" }}
        onRowClick={setDetail}
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="max-w-md w-full p-0 overflow-y-auto">
          {detail && (
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <UserAvatar name={detail.name} className="h-12 w-12" />
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-semibold">{detail.name}</SheetTitle>
                  <SheetDescription className="truncate">{detail.email}</SheetDescription>
                </div>
                <StatusBadge status={detail.status} className="ml-auto" />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd>{detail.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Location</dt>
                  <dd>{detail.location ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Joined</dt>
                  <dd>{formatDate(detail.joinedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last active</dt>
                  <dd>{detail.lastActiveAt ? timeAgo(detail.lastActiveAt) : "—"}</dd>
                </div>
              </dl>
              <section>
                <h3 className="text-sm font-semibold mb-2">Enrollments ({detailEnrollments.length})</h3>
                {detailEnrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No enrollments.</p>
                ) : (
                  <ul className="space-y-3">
                    {detailEnrollments.map((e) => {
                      const pct = e.status === "completed" ? 100 : (progressFor(e.userId, e.courseId) ?? 0);
                      return (
                        <li key={e.id} className="text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium line-clamp-1">{courses.find((c) => c.id === e.courseId)?.title}</span>
                            <StatusBadge status={e.status} />
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Progress value={pct} className="h-1.5" />
                            <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-2">Orders ({detailOrders.length})</h3>
                {detailOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {detailOrders.map((o) => (
                      <li key={o.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-xs">{o.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                        </div>
                        <span className="tabular-nums">{formatINR(o.total)}</span>
                        <StatusBadge status={o.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-2">Certificates ({detailCerts.length})</h3>
                {detailCerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None issued.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {detailCerts.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <code className="text-xs">{c.id}</code>
                        <StatusBadge status={c.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={confirm.payload?.status === "active" ? "Suspend student?" : "Reactivate student?"}
        description={
          confirm.payload?.status === "active"
            ? `${confirm.payload?.name} will no longer be able to log in or access courses until reactivated.`
            : `${confirm.payload?.name} will regain access to their account and courses.`
        }
        confirmLabel={confirm.payload?.status === "active" ? "Suspend" : "Reactivate"}
        destructive={confirm.payload?.status === "active"}
        loading={confirm.busy}
        onConfirm={toggleStatus}
      />
    </AdminPage>
  );
}

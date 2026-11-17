"use client";

import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { paymentService } from "@/services/payment.service";
import { ApiError } from "@/services/api-client";
import { formatDate } from "@/lib/format";

export default function EnrollmentsPage() {
  const enrollments = useDb((s) => s.enrollments);
  const users = useDb((s) => s.users);
  const courses = useDb((s) => s.courses);
  const orders = useDb((s) => s.orders);
  const [status, setStatus] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const confirm = useConfirm();

  const userName = (id) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const courseTitle = (id) => courses.find((c) => c.id === id)?.title ?? "—";
  const filter = useMemo(
    () => (e) => (status === "all" || e.status === status) && (courseId === "all" || e.courseId === courseId),
    [status, courseId],
  );

  const refund = async () => {
    const e = confirm.payload;
    if (!e.orderId) {
      toast.error("No order is linked to this enrollment.");
      confirm.close();
      return;
    }
    confirm.setBusy(true);
    try {
      await paymentService.refund(e.orderId);
      toast.success("Enrollment refunded");
      confirm.close();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Refund failed");
      confirm.setBusy(false);
    }
  };

  const columns = [
    {
      id: "student",
      header: "Student",
      sortValue: (e) => userName(e.userId),
      cell: (e) => <span className="font-medium">{userName(e.userId)}</span>,
    },
    {
      id: "course",
      header: "Course",
      sortValue: (e) => courseTitle(e.courseId),
      cell: (e) => <span className="text-sm line-clamp-1 max-w-xs block">{courseTitle(e.courseId)}</span>,
    },
    {
      id: "enrolled",
      header: "Enrolled",
      sortValue: (e) => e.enrolledAt,
      cell: (e) => <span className="whitespace-nowrap text-sm">{formatDate(e.enrolledAt)}</span>,
    },
    {
      id: "completed",
      header: "Completed",
      sortValue: (e) => e.completedAt ?? "",
      cell: (e) => <span className="whitespace-nowrap text-sm text-muted-foreground">{e.completedAt ? formatDate(e.completedAt) : "—"}</span>,
    },
    { id: "order", header: "Order", cell: (e) => <code className="text-xs">{orders.find((o) => o.id === e.orderId)?.orderNumber ?? "—"}</code> },
    { id: "status", header: "Status", sortValue: (e) => e.status, cell: (e) => <StatusBadge status={e.status} /> },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (e) =>
        e.status !== "refunded" ? (
          <Button variant="ghost" size="sm" onClick={() => confirm.ask(e)}>
            <Undo2 /> Mark refunded
          </Button>
        ) : null,
    },
  ];

  return (
    <AdminPage title="Enrollments" description="Who is enrolled in what, and the order each enrollment came from.">
      <DataTable
        rows={enrollments}
        columns={columns}
        rowKey={(e) => e.id}
        searchable={(e) => `${userName(e.userId)} ${courseTitle(e.courseId)}`}
        searchPlaceholder="Search student or course…"
        filter={filter}
        initialSort={{ id: "enrolled", dir: "desc" }}
        toolbar={
          <>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-56" aria-label="Course filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36" aria-label="Status filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title="Refund and revoke access?"
        description={`${confirm.payload ? userName(confirm.payload.userId) : ""} will lose access to "${confirm.payload ? courseTitle(confirm.payload.courseId) : ""}" and the linked payment will be marked refunded.`}
        confirmLabel="Refund"
        destructive
        loading={confirm.busy}
        onConfirm={refund}
      />
    </AdminPage>
  );
}

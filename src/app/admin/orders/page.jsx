"use client";

import { useMemo, useState } from "react";
import { CreditCard, Receipt, Undo2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useDb } from "@/store/db.store";
import { paymentService } from "@/services/payment.service";
import { ApiError } from "@/services/api-client";
import { formatDateTime, formatINR } from "@/lib/format";

const METHOD = { razorpay: "Razorpay", upi: "UPI", card: "Card", netbanking: "Net banking" };

export default function OrdersPage() {
  const orders = useDb((s) => s.orders);
  const users = useDb((s) => s.users);
  const courses = useDb((s) => s.courses);
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState(null);
  const confirm = useConfirm();

  const userName = (id) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const courseTitle = (id) => courses.find((c) => c.id === id)?.title ?? "—";
  const filter = useMemo(() => (o) => status === "all" || o.status === status, [status]);

  const totals = useMemo(() => {
    const ok = orders.filter((o) => o.status === "successful");
    return {
      revenue: ok.reduce((a, o) => a + o.total, 0),
      tax: ok.reduce((a, o) => a + o.tax, 0),
      refunded: orders.filter((o) => o.status === "refunded").reduce((a, o) => a + o.total, 0),
      failed: orders.filter((o) => o.status === "failed" || o.status === "cancelled").length,
    };
  }, [orders]);

  const refund = async () => {
    const o = confirm.payload;
    confirm.setBusy(true);
    try {
      await paymentService.refund(o.id);
      toast.success(`Refunded ${o.orderNumber}`);
      confirm.close();
      setDetail(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Refund failed");
      confirm.setBusy(false);
    }
  };

  const columns = [
    { id: "order", header: "Order", sortValue: (o) => o.orderNumber, cell: (o) => <code className="text-xs font-medium">{o.orderNumber}</code> },
    { id: "student", header: "Student", sortValue: (o) => userName(o.userId), cell: (o) => userName(o.userId) },
    { id: "course", header: "Course", cell: (o) => <span className="text-sm line-clamp-1 max-w-[220px] block">{courseTitle(o.courseId)}</span> },
    {
      id: "subtotal",
      header: "Amount",
      sortValue: (o) => o.subtotal,
      cell: (o) => <span className="tabular-nums">{formatINR(o.subtotal)}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      id: "discount",
      header: "Discount",
      cell: (o) => (
        <span className="tabular-nums text-sm">
          {o.discount ? `-${formatINR(o.discount)}` : "—"}
          {o.couponCode && <span className="block text-[10px] text-muted-foreground">{o.couponCode}</span>}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      id: "tax",
      header: "GST",
      cell: (o) => <span className="tabular-nums text-sm">{formatINR(o.tax)}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      id: "total",
      header: "Total",
      sortValue: (o) => o.total,
      cell: (o) => <span className="tabular-nums font-semibold">{formatINR(o.total)}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { id: "method", header: "Method", cell: (o) => <span className="text-sm">{METHOD[o.paymentMethod]}</span> },
    { id: "status", header: "Status", sortValue: (o) => o.status, cell: (o) => <StatusBadge status={o.status} /> },
    {
      id: "date",
      header: "Date",
      sortValue: (o) => o.createdAt,
      cell: (o) => <span className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(o.createdAt)}</span>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (o) => (
        <Button variant="ghost" size="sm" onClick={() => setDetail(o)}>
          <Receipt /> Details
        </Button>
      ),
    },
  ];

  return (
    <AdminPage title="Payments" description="Orders processed through the payment gateway. Refunds revoke the linked enrollment.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collected revenue"
          value={formatINR(totals.revenue, { compact: true })}
          icon={Wallet}
          tone="accent"
          hint="Successful payments incl. GST"
        />
        <StatCard label="GST collected" value={formatINR(totals.tax, { compact: true })} icon={Receipt} tone="secondary" />
        <StatCard label="Refunded" value={formatINR(totals.refunded)} icon={Undo2} tone="muted" />
        <StatCard label="Failed / cancelled" value={totals.failed} icon={XCircle} tone="primary" hint="Gateway did not confirm" />
      </div>
      <DataTable
        rows={orders}
        columns={columns}
        rowKey={(o) => o.id}
        searchable={(o) => `${o.orderNumber} ${userName(o.userId)} ${courseTitle(o.courseId)} ${o.couponCode ?? ""}`}
        searchPlaceholder="Search order, student or course…"
        filter={filter}
        initialSort={{ id: "date", dir: "desc" }}
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["successful", "pending", "failed", "cancelled", "refunded"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-secondary" /> {detail.orderNumber}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(detail.createdAt)} · {METHOD[detail.paymentMethod]}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium">{userName(detail.userId)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Course</span>
                  <span className="font-medium text-right">{courseTitle(detail.courseId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={detail.status} />
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(detail.subtotal)}</span>
                </div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount {detail.couponCode && `(${detail.couponCode})`}</span>
                    <span className="tabular-nums">-{formatINR(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (18%)</span>
                  <span className="tabular-nums">{formatINR(detail.tax)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span className="tabular-nums">{formatINR(detail.total)}</span>
                </div>
                <Separator />
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-muted-foreground">Gateway order</dt>
                  <dd>
                    <code>{detail.gatewayOrderId ?? "—"}</code>
                  </dd>
                  <dt className="text-muted-foreground">Gateway payment</dt>
                  <dd>
                    <code>{detail.gatewayPaymentId ?? "—"}</code>
                  </dd>
                  <dt className="text-muted-foreground">Paid at</dt>
                  <dd>{detail.paidAt ? formatDateTime(detail.paidAt) : "—"}</dd>
                </dl>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                {detail.status === "successful" && (
                  <Button variant="destructive" onClick={() => confirm.ask(detail)}>
                    <Undo2 /> Refund
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title="Refund this payment?"
        description={`${confirm.payload?.orderNumber} for ${confirm.payload ? formatINR(confirm.payload.total) : ""} will be marked refunded and the learner's enrollment revoked. In production this triggers a gateway refund.`}
        confirmLabel="Refund"
        destructive
        loading={confirm.busy}
        onConfirm={refund}
      />
    </AdminPage>
  );
}

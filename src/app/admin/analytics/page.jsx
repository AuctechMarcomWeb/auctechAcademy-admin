"use client";

import { useMemo, useState } from "react";
import { Award, BarChart3, ClipboardList, Wallet } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { CategoryBarChart, DonutChart, HorizontalBarChart, SimpleLineChart, TrendAreaChart } from "@/components/admin/charts-lazy";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useDb } from "@/store/db.store";
import { useLearning } from "@/store/learning.store";
import { computeAdminStats, enrollmentsByCategory, monthlyRevenue } from "@/services/admin.service";
import { formatINR } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnalyticsPage() {
  const db = useDb();
  const attempts = useLearning((s) => s.attempts);
  const [months, setMonths] = useState("6");
  const n = Number(months);

  const stats = useMemo(() => computeAdminStats(db), [db]);
  const revenue = useMemo(() => monthlyRevenue(db, n), [db, n]);
  const enrollTrend = useMemo(() => revenue.map((p) => ({ label: p.label, value: p.secondary ?? 0 })), [revenue]);
  const byCategory = useMemo(() => enrollmentsByCategory(db), [db]);

  const completionByCourse = useMemo(
    () =>
      db.courses
        .filter((c) => c.status === "published")
        .map((c) => {
          const enr = db.enrollments.filter((e) => e.courseId === c.id && e.status !== "refunded");
          const done = enr.filter((e) => e.status === "completed").length;
          return { label: c.title, value: enr.length ? Math.round((done / enr.length) * 100) : 0, secondary: enr.length };
        })
        .filter((p) => p.secondary)
        .sort((a, b) => b.value - a.value),
    [db.courses, db.enrollments],
  );

  const paymentBreakdown = useMemo(() => {
    const groups = {};
    db.orders.forEach((o) => (groups[o.status] = (groups[o.status] ?? 0) + 1));
    return Object.entries(groups).map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: v }));
  }, [db.orders]);

  const quizPerformance = useMemo(() => {
    const best = {};
    attempts.forEach((a) => (best[a.quizId] = Math.max(best[a.quizId] ?? 0, a.scorePercent)));
    return db.quizzes
      .filter((q) => best[q.id] !== undefined)
      .map((q) => ({ label: q.title, value: best[q.id] }))
      .slice(0, 12);
  }, [attempts, db.quizzes]);

  const certsOverTime = useMemo(() => {
    const now = new Date();
    const pts = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = db.certificates.filter((c) => {
        const x = new Date(c.issuedAt);
        return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
      }).length;
      pts.push({ label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, value: count });
    }
    return pts;
  }, [db.certificates, n]);

  const avgQuiz = quizPerformance.length ? Math.round(quizPerformance.reduce((a, p) => a + p.value, 0) / quizPerformance.length) : 0;

  return (
    <AdminPage
      title="Analytics"
      description="Trends across revenue, enrollments, completion and assessment performance. Figures are calculated from the live database."
      actions={
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatINR(stats.totalRevenue, { compact: true })}
          icon={Wallet}
          tone="accent"
          hint="All-time successful payments"
        />
        <StatCard label="Completion rate" value={`${stats.completionRate}%`} icon={BarChart3} tone="success" />
        <StatCard
          label="Avg. best quiz score"
          value={`${avgQuiz}%`}
          icon={ClipboardList}
          tone="secondary"
          hint={`${quizPerformance.length} quizzes with attempts`}
        />
        <StatCard label="Certificates valid" value={stats.certificatesIssued} icon={Award} tone="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
            <CardDescription>Successful payments per month (incl. GST).</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendAreaChart data={revenue} name="Revenue" money />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enrollments trend</CardTitle>
            <CardDescription>New enrollments per month.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendAreaChart data={enrollTrend} name="Enrollments" color="var(--chart-3)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enrollments by category</CardTitle>
          </CardHeader>
          <CardContent>{byCategory.length ? <CategoryBarChart data={byCategory} /> : <EmptyState title="No data" compact />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={paymentBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completion rate by course</CardTitle>
            <CardDescription>Completed enrollments as a share of all enrollments.</CardDescription>
          </CardHeader>
          <CardContent>
            {completionByCourse.length ? (
              <HorizontalBarChart data={completionByCourse} unit="%" max={100} name="Completion" />
            ) : (
              <EmptyState title="No data" compact />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quiz performance</CardTitle>
            <CardDescription>Best score per quiz across learners on this device (demo telemetry).</CardDescription>
          </CardHeader>
          <CardContent>
            {quizPerformance.length ? (
              <HorizontalBarChart data={quizPerformance} unit="%" max={100} name="Best score" color="var(--chart-1)" />
            ) : (
              <EmptyState title="No quiz attempts recorded" description="Attempts appear once a learner takes a quiz in the course player." compact />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Certificates issued over time</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart data={certsOverTime} name="Certificates" color="var(--chart-4)" />
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}

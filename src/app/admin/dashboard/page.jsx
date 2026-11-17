"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Award, BookOpen, CheckCircle2, CreditCard, FileCheck2, Plus, ShieldCheck, UserCheck, Users, Wallet } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { CategoryBarChart, RevenueChart } from "@/components/admin/charts-lazy";
import { StatCard } from "@/components/shared/stat-card";
import { SectionHeading } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { useDb } from "@/store/db.store";
import { computeAdminStats, enrollmentsByCategory, monthlyRevenue, topCourses } from "@/services/admin.service";
import { formatDate, formatINR, timeAgo } from "@/lib/format";
import { ROUTES, siteHref } from "@/lib/constants";

export default function AdminDashboardPage() {
  const db = useDb();
  const stats = useMemo(() => computeAdminStats(db), [db]);
  const revenue = useMemo(() => monthlyRevenue(db, 6), [db]);
  const byCategory = useMemo(() => enrollmentsByCategory(db), [db]);
  const top = useMemo(() => topCourses(db, 5), [db]);
  const recentOrders = useMemo(() => [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [db.orders]);
  const recentActivity = useMemo(() => [...db.activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8), [db.activity]);
  const userName = (id) => db.users.find((u) => u.id === id)?.name ?? "Unknown";
  const courseTitle = (id) => db.courses.find((c) => c.id === id)?.title ?? "—";

  return (
    <AdminPage
      title="Dashboard"
      description="Platform overview across learners, catalogue, revenue and certification."
      actions={
        <>
          <Button asChild>
            <Link href={ROUTES.admin.createCourse}>
              <Plus /> Create course
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.admin.assignments}>
              <FileCheck2 /> Review assignments
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={siteHref(ROUTES.verify)} target="_blank">
              <ShieldCheck /> Verify certificate
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Students"
          value={stats.totalStudents}
          icon={Users}
          tone="secondary"
          hint={`${stats.activeStudents} active in the last 7 days`}
        />
        <StatCard label="Total Courses" value={stats.totalCourses} icon={BookOpen} tone="primary" hint="Published courses" />
        <StatCard
          label="Total Revenue"
          value={formatINR(stats.totalRevenue, { compact: true })}
          icon={Wallet}
          tone="accent"
          hint="Successful payments, incl. GST"
        />
        <StatCard label="Total Enrollments" value={stats.totalEnrollments} icon={UserCheck} tone="success" hint="Active + completed" />
        <StatCard label="Active Students" value={stats.activeStudents} icon={Users} tone="secondary" hint="Logged in this week" />
        <StatCard
          label="Course Completion Rate"
          value={`${stats.completionRate}%`}
          icon={CheckCircle2}
          tone="success"
          hint="Completed ÷ enrollments"
        />
        <StatCard label="Certificates Issued" value={stats.certificatesIssued} icon={Award} tone="accent" hint="Currently valid" />
        <StatCard
          label="Pending Orders"
          value={db.orders.filter((o) => o.status === "pending").length}
          icon={CreditCard}
          tone="muted"
          hint="Awaiting gateway confirmation"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Revenue and enrollments — last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenue} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Enrollments by category</CardTitle>
          </CardHeader>
          <CardContent>{byCategory.length ? <CategoryBarChart data={byCategory} /> : <EmptyState title="No enrollments yet" compact />}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top courses by revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Enrollments</TableHead>
                  <TableHead className="text-right">Completions</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.map((t) => (
                  <TableRow key={t.course.id}>
                    <TableCell>
                      <Link href={ROUTES.admin.editCourse(t.course.id)} className="font-medium hover:text-secondary line-clamp-1">
                        {t.course.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.enrollments}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.completions}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatINR(t.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeading
              title="Recent orders"
              className="mb-0"
              action={
                <Button asChild variant="link" size="sm">
                  <Link href={ROUTES.admin.orders}>View all</Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <p className="font-medium text-xs">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{courseTitle(o.courseId)}</p>
                    </TableCell>
                    <TableCell className="text-sm">{userName(o.userId)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(o.total)}</TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent learner activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <EmptyState title="No activity recorded" compact />
          ) : (
            <ul className="divide-y divide-border">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {userName(a.userId)} · {formatDate(a.at, "d MMM yyyy, h:mm a")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}

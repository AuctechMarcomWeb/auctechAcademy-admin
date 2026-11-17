"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, FileCheck2, Pencil } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { formatDuration } from "@/lib/format";
import { ROUTES } from "@/lib/constants";

export default function ModulesPage() {
  const courses = useDb((s) => s.courses);
  const [courseId, setCourseId] = useState("all");

  const rows = useMemo(
    () =>
      courses.flatMap((c) => c.modules.map((m) => ({ ...m, courseTitle: c.title, duration: m.lessons.reduce((a, l) => a + l.durationSeconds, 0) }))),
    [courses],
  );
  const filter = useMemo(() => (r) => courseId === "all" || r.courseId === courseId, [courseId]);

  const columns = [
    {
      id: "course",
      header: "Course",
      sortValue: (r) => r.courseTitle,
      cell: (r) => <span className="text-sm font-medium line-clamp-1 max-w-[220px] block">{r.courseTitle}</span>,
    },
    { id: "order", header: "#", sortValue: (r) => r.order, cell: (r) => <span className="tabular-nums text-muted-foreground">{r.order}</span> },
    {
      id: "title",
      header: "Module",
      sortValue: (r) => r.title,
      cell: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1 max-w-sm">{r.description}</p>
        </div>
      ),
    },
    {
      id: "lessons",
      header: "Lessons",
      sortValue: (r) => r.lessons.length,
      cell: (r) => <span className="tabular-nums">{r.lessons.length}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { id: "duration", header: "Duration", sortValue: (r) => r.duration, cell: (r) => formatDuration(r.duration) },
    {
      id: "assessment",
      header: "Assessment",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.quizId && (
            <Badge variant="secondary">
              <ClipboardList className="h-3 w-3" /> Quiz
            </Badge>
          )}
          {r.assignmentId && (
            <Badge variant="accent">
              <FileCheck2 className="h-3 w-3" /> Assignment
            </Badge>
          )}
          {r.isFinalAssessment && <Badge variant="default">Final</Badge>}
          {!r.quizId && !r.assignmentId && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (r) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={ROUTES.admin.editCourse(r.courseId)}>
            <Pencil /> Edit in course
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <AdminPage title="Modules" description="Every module across the catalogue. Edit structure from the course editor.">
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.title} ${r.courseTitle}`}
        searchPlaceholder="Search modules…"
        filter={filter}
        pageSize={15}
        toolbar={
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-64" aria-label="Course filter">
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
        }
      />
    </AdminPage>
  );
}

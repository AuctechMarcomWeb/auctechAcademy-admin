"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Paperclip } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { LessonEditDialog } from "@/components/admin/lesson-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { formatDuration } from "@/lib/format";

function shortUrl(url) {
  try {
    const u = new URL(url);
    const file = u.pathname.split("/").pop();
    return `${u.hostname}/…/${file}`;
  } catch {
    return url;
  }
}

export default function LessonsPage() {
  const courses = useDb((s) => s.courses);
  const [courseId, setCourseId] = useState("all");
  const [editing, setEditing] = useState(null);

  const rows = useMemo(
    () => courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, course: c, moduleTitle: m.title, moduleOrder: m.order })))),
    [courses],
  );
  const filter = useMemo(() => (r) => courseId === "all" || r.course.id === courseId, [courseId]);

  const columns = [
    {
      id: "course",
      header: "Course",
      sortValue: (r) => r.course.title,
      cell: (r) => <span className="text-sm line-clamp-1 max-w-[200px] block">{r.course.title}</span>,
    },
    {
      id: "module",
      header: "Module",
      sortValue: (r) => `${r.course.title}${r.moduleOrder}`,
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.moduleOrder}. {r.moduleTitle}
        </span>
      ),
    },
    {
      id: "lesson",
      header: "Lesson",
      sortValue: (r) => r.title,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {r.order}. {r.title}
          </span>
          {r.isPreview && (
            <Badge variant="accent">
              <Eye className="h-3 w-3" /> Preview
            </Badge>
          )}
        </div>
      ),
    },
    { id: "duration", header: "Duration", sortValue: (r) => r.durationSeconds, cell: (r) => formatDuration(r.durationSeconds) },
    { id: "video", header: "Video", cell: (r) => <code className="text-xs text-muted-foreground">{shortUrl(r.videoUrl)}</code> },
    {
      id: "resources",
      header: "Resources",
      sortValue: (r) => r.resources.length,
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /> {r.resources.length}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
          <Pencil /> Edit
        </Button>
      ),
    },
  ];

  return (
    <AdminPage title="Lessons" description="All lessons across courses. Edit titles, durations, video sources and preview flags.">
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.title} ${r.moduleTitle} ${r.course.title}`}
        searchPlaceholder="Search lessons…"
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
      <LessonEditDialog course={editing?.course ?? null} lesson={editing} onClose={() => setEditing(null)} />
    </AdminPage>
  );
}

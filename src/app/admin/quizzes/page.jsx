"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { QuizEditorDialog } from "@/components/admin/quiz-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { ApiError } from "@/services/api-client";
import { courseService } from "@/services/course.service";

export default function QuizzesPage() {
  const quizzes = useDb((s) => s.quizzes);
  const courses = useDb((s) => s.courses);
  const [courseId, setCourseId] = useState("all");
  const [editing, setEditing] = useState(null);
  const confirm = useConfirm();

  const courseTitle = (id) => courses.find((c) => c.id === id)?.title ?? "—";
  const moduleTitle = (q) => courses.find((c) => c.id === q.courseId)?.modules.find((m) => m.id === q.moduleId)?.title ?? "—";
  const filter = useMemo(() => (q) => courseId === "all" || q.courseId === courseId, [courseId]);

  const remove = async () => {
    const q = confirm.payload;
    confirm.setBusy(true);
    try {
      await courseService.removeQuiz(q.id);
      const course = courses.find((c) => c.id === q.courseId);
      if (course) await courseService.save({ ...course, modules: course.modules.map((m) => (m.quizId === q.id ? { ...m, quizId: undefined } : m)) });
      toast.success("Quiz deleted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete the quiz");
    } finally {
      confirm.close();
    }
  };

  const columns = [
    {
      id: "course",
      header: "Course",
      sortValue: (q) => courseTitle(q.courseId),
      cell: (q) => <span className="text-sm line-clamp-1 max-w-[200px] block">{courseTitle(q.courseId)}</span>,
    },
    { id: "module", header: "Module", cell: (q) => <span className="text-sm text-muted-foreground">{moduleTitle(q)}</span> },
    { id: "title", header: "Quiz", sortValue: (q) => q.title, cell: (q) => <span className="font-medium">{q.title}</span> },
    {
      id: "questions",
      header: "Questions",
      sortValue: (q) => q.questions.length,
      cell: (q) => <span className="tabular-nums">{q.questions.length}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { id: "pass", header: "Pass %", sortValue: (q) => q.passingScore, cell: (q) => <Badge variant="secondary">{q.passingScore}%</Badge> },
    {
      id: "time",
      header: "Time limit",
      cell: (q) => (q.timeLimitSeconds ? `${Math.round(q.timeLimitSeconds / 60)} min` : <span className="text-muted-foreground">None</span>),
    },
    {
      id: "attempts",
      header: "Attempts",
      cell: (q) => (q.maxAttempts ? `Max ${q.maxAttempts}` : <span className="text-muted-foreground">Unlimited</span>),
    },
    {
      id: "actions",
      header: "",
      className: "text-right whitespace-nowrap",
      cell: (q) => (
        <>
          <Button variant="ghost" size="icon-sm" aria-label="Edit quiz" onClick={() => setEditing(q)}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete quiz" className="text-destructive" onClick={() => confirm.ask(q)}>
            <Trash2 />
          </Button>
        </>
      ),
    },
  ];

  return (
    <AdminPage title="Quizzes" description="Module and final-assessment quizzes. Edit questions, passing scores and attempt limits.">
      <DataTable
        rows={quizzes}
        columns={columns}
        rowKey={(q) => q.id}
        searchable={(q) => `${q.title} ${courseTitle(q.courseId)}`}
        searchPlaceholder="Search quizzes…"
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
      <QuizEditorDialog quiz={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title="Delete quiz?"
        description={`"${confirm.payload?.title}" will be removed and its module will no longer require a quiz. Learner attempts are kept for audit.`}
        confirmLabel="Delete"
        destructive
        loading={confirm.busy}
        onConfirm={remove}
      />
    </AdminPage>
  );
}

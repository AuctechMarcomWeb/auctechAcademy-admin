"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileCheck2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { uploadService } from "@/services/upload.service";
import { learningService } from "@/services/learning.service";
import { gradeFromScore } from "@/lib/curriculum";
import { formatDate, formatDateTime } from "@/lib/format";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected", "under_review"]),
  marks: z.coerce.number().min(0),
  feedback: z.string().min(5, "Leave a short note for the learner"),
});

export default function AssignmentsAdminPage() {
  const assignments = useDb((s) => s.assignments);
  const submissions = useDb((s) => s.assignmentSubmissions);
  const users = useDb((s) => s.users);
  const courses = useDb((s) => s.courses);
  const [status, setStatus] = useState("all");
  const [reviewing, setReviewing] = useState(null);

  const courseTitle = (id) => courses.find((c) => c.id === id)?.title ?? "—";
  const userName = (id) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const assignmentOf = (id) => assignments.find((a) => a.id === id);
  const filter = useMemo(() => (s) => status === "all" || s.status === status, [status]);

  const form = useForm({ resolver: zodResolver(reviewSchema), defaultValues: { status: "approved", marks: 0, feedback: "" } });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const marks = watch("marks");
  const reviewAssignment = reviewing ? assignmentOf(reviewing.assignmentId) : undefined;
  const pct = reviewAssignment?.maxMarks ? Math.round((Number(marks) / reviewAssignment.maxMarks) * 100) : 0;

  useEffect(() => {
    if (reviewing)
      reset({ status: reviewing.status === "rejected" ? "rejected" : "approved", marks: reviewing.marks ?? 0, feedback: reviewing.feedback ?? "" });
  }, [reviewing, reset]);

  const onReview = async (v) => {
    if (!reviewing) return;
    await learningService.reviewSubmission(reviewing.id, {
      status: v.status,
      marks: v.marks,
      grade: v.status === "approved" ? gradeFromScore(pct) : undefined,
      feedback: v.feedback,
    });
    toast.success(`Submission marked ${v.status.replace("_", " ")}`);
    setReviewing(null);
  };

  const subColumns = [
    {
      id: "student",
      header: "Student",
      sortValue: (s) => userName(s.userId),
      cell: (s) => <span className="font-medium">{userName(s.userId)}</span>,
    },
    {
      id: "assignment",
      header: "Assignment",
      cell: (s) => {
        const a = assignmentOf(s.assignmentId);
        return (
          <div className="min-w-0">
            <p className="text-sm font-medium line-clamp-1">{a?.title ?? "—"}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{a ? courseTitle(a.courseId) : ""}</p>
          </div>
        );
      },
    },
    {
      id: "file",
      header: "File",
      cell: (s) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" /> {s.fileName ?? "—"} {s.attempt > 1 && <Badge variant="muted">attempt {s.attempt}</Badge>}
        </span>
      ),
    },
    {
      id: "submitted",
      header: "Submitted",
      sortValue: (s) => s.submittedAt ?? "",
      cell: (s) => <span className="text-xs whitespace-nowrap">{s.submittedAt ? formatDateTime(s.submittedAt) : "—"}</span>,
    },
    { id: "status", header: "Status", sortValue: (s) => s.status, cell: (s) => <StatusBadge status={s.status} /> },
    {
      id: "marks",
      header: "Marks",
      sortValue: (s) => s.marks ?? -1,
      cell: (s) =>
        typeof s.marks === "number" ? (
          <span className="tabular-nums">
            {s.marks}/{assignmentOf(s.assignmentId)?.maxMarks ?? 100}{" "}
            {s.grade && (
              <Badge variant="success" className="ml-1">
                {s.grade}
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (s) => (
        <Button variant={s.status === "submitted" || s.status === "under_review" ? "default" : "outline"} size="sm" onClick={() => setReviewing(s)}>
          <FileCheck2 /> {s.status === "approved" || s.status === "rejected" ? "Re-review" : "Review"}
        </Button>
      ),
    },
  ];

  const aColumns = [
    { id: "title", header: "Assignment", sortValue: (a) => a.title, cell: (a) => <span className="font-medium">{a.title}</span> },
    {
      id: "course",
      header: "Course",
      sortValue: (a) => courseTitle(a.courseId),
      cell: (a) => <span className="text-sm line-clamp-1 max-w-[240px] block">{courseTitle(a.courseId)}</span>,
    },
    { id: "deadline", header: "Deadline", sortValue: (a) => a.deadline, cell: (a) => formatDate(a.deadline) },
    { id: "max", header: "Max marks", cell: (a) => a.maxMarks, className: "text-right", headerClassName: "text-right" },
    {
      id: "resub",
      header: "Resubmission",
      cell: (a) => (a.allowResubmission ? <Badge variant="success">Allowed</Badge> : <Badge variant="muted">No</Badge>),
    },
    {
      id: "subs",
      header: "Submissions",
      sortValue: (a) => submissions.filter((s) => s.assignmentId === a.id).length,
      cell: (a) => <span className="tabular-nums">{submissions.filter((s) => s.assignmentId === a.id).length}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
  ];

  const pending = submissions.filter((s) => s.status === "submitted" || s.status === "under_review").length;

  return (
    <AdminPage title="Assignments" description={`${pending} submission${pending === 1 ? "" : "s"} awaiting review.`}>
      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">Submissions {pending > 0 && <Badge variant="accent">{pending}</Badge>}</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions">
          <DataTable
            rows={submissions}
            columns={subColumns}
            rowKey={(s) => s.id}
            searchable={(s) => `${userName(s.userId)} ${assignmentOf(s.assignmentId)?.title ?? ""}`}
            searchPlaceholder="Search student or assignment…"
            filter={filter}
            initialSort={{ id: "submitted", dir: "desc" }}
            emptyTitle="No submissions yet"
            toolbar={
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40" aria-label="Status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["submitted", "under_review", "approved", "rejected"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </TabsContent>
        <TabsContent value="assignments">
          <DataTable
            rows={assignments}
            columns={aColumns}
            rowKey={(a) => a.id}
            searchable={(a) => `${a.title} ${courseTitle(a.courseId)}`}
            searchPlaceholder="Search assignments…"
          />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(reviewing)} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent size="lg">
          {reviewing && reviewAssignment && (
            <>
              <DialogHeader>
                <DialogTitle>Review submission</DialogTitle>
                <DialogDescription>
                  {userName(reviewing.userId)} · {reviewAssignment.title} · {courseTitle(reviewAssignment.courseId)}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">File:</span> {reviewing.fileName ?? "—"}{" "}
                  {reviewing.fileSize ? `(${(reviewing.fileSize / 1024 / 1024).toFixed(2)} MB)` : ""}{" "}
                  {reviewing.fileUrl && (
                    <button
                      type="button"
                      className="ml-1 font-medium text-secondary hover:underline"
                      onClick={() =>
                        uploadService
                          .download(reviewing.fileUrl, reviewing.fileName)
                          .catch((e) => toast.error(e instanceof Error ? e.message : "Download failed"))
                      }
                    >
                      Download
                    </button>
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Submitted:</span> {reviewing.submittedAt ? formatDateTime(reviewing.submittedAt) : "—"} ·
                  attempt {reviewing.attempt}
                </p>
                {reviewing.note && (
                  <p>
                    <span className="text-muted-foreground">Learner note:</span> {reviewing.note}
                  </p>
                )}
                <p className="text-xs text-muted-foreground pt-1">Instructions: {reviewAssignment.instructions}</p>
              </div>
              <form onSubmit={handleSubmit(onReview)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Decision" required>
                    <Select value={watch("status")} onValueChange={(v) => setValue("status", v)}>
                      <SelectTrigger aria-label="Decision">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                        <SelectItem value="under_review">Keep under review</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={`Marks (out of ${reviewAssignment.maxMarks})`} htmlFor="marks" error={errors.marks?.message}>
                    <Input id="marks" type="number" min={0} max={reviewAssignment.maxMarks} {...register("marks")} />
                  </FormField>
                  <FormField label="Grade (auto)">
                    <div className="h-10 flex items-center">
                      <Badge variant="secondary" className="text-sm">
                        {pct}% · {gradeFromScore(pct)}
                      </Badge>
                    </div>
                  </FormField>
                </div>
                <FormField label="Feedback to learner" htmlFor="feedback" required error={errors.feedback?.message}>
                  <Textarea id="feedback" rows={4} {...register("feedback")} placeholder="What was strong, what to improve…" />
                </FormField>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setReviewing(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    Save review
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

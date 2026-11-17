"use client";

import { useMemo, useState } from "react";
import { CloudUpload, Film, Info } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { DemoTag } from "@/components/shared/demo-banner";
import { useDb } from "@/store/db.store";
import { uploadService } from "@/services/upload.service";
import { ApiError } from "@/services/api-client";
import { courseService } from "@/services/course.service";
import { formatDuration } from "@/lib/format";

export default function VideosPage() {
  const courses = useDb((s) => s.courses);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("");
  const [progress, setProgress] = useState(null);

  const rows = useMemo(() => {
    const map = new Map();
    courses.forEach((c) =>
      c.modules.forEach((m) =>
        m.lessons.forEach((l) => {
          let row = map.get(l.videoUrl);
          if (!row) {
            let host = "";
            let fileName = l.videoUrl;
            try {
              const u = new URL(l.videoUrl);
              host = u.hostname;
              fileName = u.pathname.split("/").pop() ?? l.videoUrl;
            } catch {}
            row = { url: l.videoUrl, fileName, host, usedBy: [] };
            map.set(l.videoUrl, row);
          }
          row.usedBy.push({ courseId: c.id, courseTitle: c.title, lessonId: l.id, lessonTitle: l.title, durationSeconds: l.durationSeconds });
        }),
      ),
    );
    return [...map.values()];
  }, [courses]);

  const lessonOptions = useMemo(
    () =>
      courses.flatMap((c) =>
        c.modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, label: `${c.title} › ${m.title} › ${l.title}`, courseId: c.id }))),
      ),
    [courses],
  );

  const upload = async () => {
    if (!file || !target) {
      toast.error("Choose a file and a lesson");
      return;
    }
    // Upload to the backend (stored under uploads/public), then point the lesson at the new URL.
    const opt = lessonOptions.find((o) => o.id === target);
    const course = courses.find((c) => c.id === opt.courseId);
    try {
      setProgress(0);
      const uploaded = await uploadService.upload(file, "video", setProgress);
      await courseService.save({
        ...course,
        modules: course.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === target ? { ...l, videoUrl: uploaded.url } : l)) })),
      });
      toast.success("Video uploaded and attached to the lesson");
      setFile(null);
      setTarget("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  const columns = [
    {
      id: "file",
      header: "Video",
      sortValue: (r) => r.fileName,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Film className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate max-w-[260px]">{r.fileName}</p>
            <p className="text-xs text-muted-foreground">{r.host}</p>
          </div>
        </div>
      ),
    },
    {
      id: "uses",
      header: "Used by",
      sortValue: (r) => r.usedBy.length,
      cell: (r) => (
        <span className="tabular-nums">
          {r.usedBy.length} lesson{r.usedBy.length === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "lessons",
      header: "Lessons",
      cell: (r) => (
        <ul className="text-xs text-muted-foreground space-y-0.5 max-w-md">
          {r.usedBy.slice(0, 3).map((u) => (
            <li key={u.lessonId} className="truncate">
              {u.courseTitle} › {u.lessonTitle} <span className="text-foreground/60">({formatDuration(u.durationSeconds)})</span>
            </li>
          ))}
          {r.usedBy.length > 3 && <li>+{r.usedBy.length - 3} more</li>}
        </ul>
      ),
    },
    {
      id: "duration",
      header: "Nominal duration",
      sortValue: (r) => r.usedBy.reduce((a, u) => a + u.durationSeconds, 0),
      cell: (r) => formatDuration(r.usedBy.reduce((a, u) => a + u.durationSeconds, 0)),
    },
  ];

  return (
    <AdminPage
      title="Videos"
      description="Media library of every video source referenced by a lesson."
      actions={
        <Button onClick={() => setOpen(true)}>
          <CloudUpload /> Upload video
        </Button>
      }
    >
      <div className="flex items-start gap-2 rounded-lg border border-secondary/30 bg-secondary/5 p-3 text-sm text-foreground/80">
        <Info className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
        <p>
          Demo lessons reference short public sample clips so sequential unlocking can be tested quickly. In production, uploads go to the media
          backend and lessons are served through signed CDN URLs. <DemoTag className="ml-1 align-middle" />
        </p>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.url}
        searchable={(r) => `${r.fileName} ${r.usedBy.map((u) => u.lessonTitle).join(" ")}`}
        searchPlaceholder="Search videos…"
      />

      <Dialog open={open} onOpenChange={(o) => progress === null && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload video</DialogTitle>
            <DialogDescription>The file is uploaded to the backend and attached to the chosen lesson.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FileDropzone
              value={file}
              onChange={setFile}
              accept="video/*"
              maxSizeMb={200}
              hint="MP4 or WebM · up to 200 MB (raise MAX_UPLOAD_MB on the backend for larger files)"
              id="video-upload"
            />
            <FormField label="Attach to lesson" required>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger aria-label="Lesson">
                  <SelectValue placeholder="Choose a lesson" />
                </SelectTrigger>
                <SelectContent>
                  {lessonOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {progress !== null && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={progress !== null}>
              Cancel
            </Button>
            <Button onClick={upload} loading={progress !== null}>
              Upload and attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

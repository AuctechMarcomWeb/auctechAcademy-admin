"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { CourseThumbnail } from "@/components/course/course-thumbnail";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { courseService } from "@/services/course.service";
import { ApiError } from "@/services/api-client";
import { courseLessonCount } from "@/data/builders";
import { formatDate, formatINR } from "@/lib/format";
import { ROUTES, siteHref } from "@/lib/constants";

export default function AdminCoursesPage() {
  const router = useRouter();
  const courses = useDb((s) => s.courses);
  const categories = useDb((s) => s.categories);
  const instructors = useDb((s) => s.instructors);
  const enrollments = useDb((s) => s.enrollments);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const confirm = useConfirm();

  const enrollCount = useMemo(() => {
    const m = {};
    enrollments.forEach((e) => e.status !== "refunded" && (m[e.courseId] = (m[e.courseId] ?? 0) + 1));
    return m;
  }, [enrollments]);

  const filter = useMemo(
    () => (c) => (category === "all" || c.categoryId === category) && (status === "all" || c.status === status),
    [category, status],
  );

  const run = async (action) => {
    confirm.setBusy(true);
    try {
      if (action.type === "delete") {
        await courseService.remove(action.course.id);
        toast.success(`Deleted "${action.course.title}"`);
      } else {
        await courseService.setStatus(action.course.id, action.type === "archive" ? "archived" : "draft");
        toast.success(`${action.type === "archive" ? "Archived" : "Unpublished"} "${action.course.title}"`);
      }
      confirm.close();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
      confirm.setBusy(false);
    }
  };

  const publish = async (course) => {
    await courseService.setStatus(course.id, "published");
    toast.success(`Published "${course.title}"`);
  };

  const columns = [
    {
      id: "title",
      header: "Course",
      sortValue: (c) => c.title,
      cell: (c) => (
        <div className="flex items-center gap-3 min-w-[260px]">
          <CourseThumbnail src={c.thumbnail} alt="" className="w-20 shrink-0" sizes="80px" />
          <div className="min-w-0">
            <Link href={ROUTES.admin.editCourse(c.id)} className="font-medium hover:text-secondary line-clamp-1">
              {c.title}
            </Link>
            <p className="text-xs text-muted-foreground line-clamp-1">{instructors.find((i) => i.id === c.instructorId)?.name}</p>
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortValue: (c) => categories.find((x) => x.id === c.categoryId)?.name ?? "",
      cell: (c) => <span className="text-sm">{categories.find((x) => x.id === c.categoryId)?.name}</span>,
    },
    { id: "level", header: "Level", sortValue: (c) => c.level, cell: (c) => c.level },
    {
      id: "price",
      header: "Price",
      sortValue: (c) => c.price,
      cell: (c) => <span className="tabular-nums">{formatINR(c.price)}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      id: "content",
      header: "Modules / Lessons",
      cell: (c) => (
        <span className="tabular-nums text-sm">
          {c.modules.length} / {courseLessonCount(c)}
        </span>
      ),
    },
    {
      id: "enrollments",
      header: "Enrollments",
      sortValue: (c) => enrollCount[c.id] ?? 0,
      cell: (c) => <span className="tabular-nums">{enrollCount[c.id] ?? 0}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { id: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <StatusBadge status={c.status} /> },
    {
      id: "updated",
      header: "Updated",
      sortValue: (c) => c.updatedAt,
      cell: (c) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.updatedAt)}</span>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => router.push(ROUTES.admin.editCourse(c.id))}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.open(siteHref(ROUTES.course(c.slug)), "_blank")}>
              <Eye /> View public page
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {c.status === "published" ? (
              <DropdownMenuItem onSelect={() => confirm.ask({ type: "unpublish", course: c })}>
                <EyeOff /> Unpublish
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => void publish(c)}>
                <Eye /> Publish
              </DropdownMenuItem>
            )}
            {c.status !== "archived" && (
              <DropdownMenuItem onSelect={() => confirm.ask({ type: "archive", course: c })}>
                <Archive /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => confirm.ask({ type: "delete", course: c })}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const action = confirm.payload;
  const copy = action
    ? {
        delete: {
          title: "Delete course?",
          desc: `"${action.course.title}" and its curriculum will be permanently removed. Courses with active enrollments cannot be deleted.`,
          label: "Delete",
        },
        unpublish: {
          title: "Unpublish course?",
          desc: `"${action.course.title}" will move back to draft and disappear from the public catalogue. Enrolled learners keep access.`,
          label: "Unpublish",
        },
        archive: { title: "Archive course?", desc: `"${action.course.title}" will be archived and hidden from the catalogue.`, label: "Archive" },
      }[action.type]
    : undefined;

  return (
    <AdminPage
      title="Courses"
      description="Create, edit, publish and retire courses in the catalogue."
      actions={
        <Button asChild>
          <Link href={ROUTES.admin.createCourse}>
            <Plus /> Create course
          </Link>
        </Button>
      }
    >
      <DataTable
        rows={courses}
        columns={columns}
        rowKey={(c) => c.id}
        searchable={(c) => `${c.title} ${c.subtitle} ${c.slug}`}
        searchPlaceholder="Search courses…"
        filter={filter}
        initialSort={{ id: "updated", dir: "desc" }}
        emptyTitle="No courses match"
        toolbar={
          <>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48" aria-label="Category filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
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
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={copy?.title ?? ""}
        description={copy?.desc}
        confirmLabel={copy?.label}
        destructive={action?.type === "delete"}
        loading={confirm.busy}
        onConfirm={() => action && run(action)}
      />
    </AdminPage>
  );
}

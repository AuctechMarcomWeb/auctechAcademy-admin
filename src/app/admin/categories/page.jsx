"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { DataTable } from "@/components/admin/data-table";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "@/store/db.store";
import { ApiError } from "@/services/api-client";
import { adminService } from "@/services/admin.service";
import { slugify, uid } from "@/lib/utils";

const ICONS = ["BookOpen", "Braces", "BrainCircuit", "Briefcase", "Code2", "Megaphone", "MonitorCog", "Palette", "Search"];

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens"),
  description: z.string().min(10, "Add a short description"),
  icon: z.string().min(1),
});

export default function CategoriesPage() {
  const categories = useDb((s) => s.categories);
  const courses = useDb((s) => s.courses);
  const [editing, setEditing] = useState(null);
  const confirm = useConfirm();

  const counts = useMemo(() => {
    const m = {};
    courses.forEach((c) => (m[c.categoryId] = (m[c.categoryId] ?? 0) + 1));
    return m;
  }, [courses]);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: "", slug: "", description: "", icon: "BookOpen" } });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const openEditor = (c) => {
    setEditing(c);
    reset(
      c === "new"
        ? { name: "", slug: "", description: "", icon: "BookOpen" }
        : { name: c.name, slug: c.slug, description: c.description, icon: c.icon },
    );
  };

  const onSubmit = async (v) => {
    const existing = editing !== "new" && editing ? editing : undefined;
    try {
      await adminService.saveCategory({ id: existing?.id ?? uid("cat"), ...v });
      toast.success(existing ? "Category updated" : "Category created");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the category");
    }
  };

  const onDelete = async () => {
    const c = confirm.payload;
    if (counts[c.id]) {
      toast.error("Move or delete the courses in this category first.");
      confirm.close();
      return;
    }
    confirm.setBusy(true);
    try {
      await adminService.deleteCategory(c.id);
      toast.success(`Deleted "${c.name}"`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete the category");
    } finally {
      confirm.close();
    }
  };

  const columns = [
    {
      id: "name",
      header: "Category",
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary/10 text-secondary">
            <DynamicIcon name={c.icon} className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">/{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      id: "description",
      header: "Description",
      cell: (c) => <span className="text-sm text-muted-foreground line-clamp-2 max-w-md block">{c.description}</span>,
    },
    {
      id: "courses",
      header: "Courses",
      sortValue: (c) => counts[c.id] ?? 0,
      cell: (c) => <span className="tabular-nums">{counts[c.id] ?? 0}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      id: "actions",
      header: "",
      className: "text-right whitespace-nowrap",
      cell: (c) => (
        <>
          <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => openEditor(c)}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete" className="text-destructive" onClick={() => confirm.ask(c)}>
            <Trash2 />
          </Button>
        </>
      ),
    },
  ];

  return (
    <AdminPage
      title="Categories"
      description="Group courses for browsing and filtering on the public catalogue."
      actions={
        <Button onClick={() => openEditor("new")}>
          <Plus /> Add category
        </Button>
      }
    >
      <DataTable
        rows={categories}
        columns={columns}
        rowKey={(c) => c.id}
        searchable={(c) => `${c.name} ${c.slug}`}
        searchPlaceholder="Search categories…"
        pageSize={12}
      />

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add category" : "Edit category"}</DialogTitle>
            <DialogDescription>Categories appear on the homepage and as filters in Explore.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Name" htmlFor="cat-name" required error={errors.name?.message}>
              <Input id="cat-name" {...register("name", { onChange: (e) => editing === "new" && setValue("slug", slugify(e.target.value)) })} />
            </FormField>
            <FormField label="Slug" htmlFor="cat-slug" required error={errors.slug?.message}>
              <Input id="cat-slug" {...register("slug")} />
            </FormField>
            <FormField label="Description" htmlFor="cat-desc" required error={errors.description?.message}>
              <Textarea id="cat-desc" rows={3} {...register("description")} />
            </FormField>
            <FormField label="Icon" required>
              <Select value={watch("icon")} onValueChange={(v) => setValue("icon", v)}>
                <SelectTrigger aria-label="Icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      <span className="inline-flex items-center gap-2">
                        <DynamicIcon name={i} className="h-4 w-4" /> {i}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title="Delete category?"
        description={`"${confirm.payload?.name}" will be removed. Categories with courses cannot be deleted.`}
        confirmLabel="Delete"
        destructive
        loading={confirm.busy}
        onConfirm={onDelete}
      />
    </AdminPage>
  );
}

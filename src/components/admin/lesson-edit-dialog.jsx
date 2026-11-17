"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { courseService } from "@/services/course.service";

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Add a short description"),
  minutes: z.coerce.number().min(1).max(600),
  videoUrl: z.string().url("Enter a valid URL"),
  isPreview: z.boolean(),
});

/** Edits a single lesson in place and saves the parent course. */
export function LessonEditDialog({ course, lesson, onClose }) {
  const form = useForm({ resolver: zodResolver(schema) });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  React.useEffect(() => {
    if (lesson)
      reset({
        title: lesson.title,
        description: lesson.description,
        minutes: Math.round(lesson.durationSeconds / 60),
        videoUrl: lesson.videoUrl,
        isPreview: Boolean(lesson.isPreview),
      });
  }, [lesson, reset]);

  const onSubmit = async (v) => {
    if (!course || !lesson) return;
    const next = {
      ...course,
      modules: course.modules.map((m) =>
        m.id !== lesson.moduleId
          ? m
          : {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id !== lesson.id
                  ? l
                  : {
                      ...l,
                      title: v.title,
                      description: v.description,
                      durationSeconds: v.minutes * 60,
                      videoUrl: v.videoUrl,
                      isPreview: v.isPreview,
                    },
              ),
            },
      ),
    };
    await courseService.save(next);
    toast.success("Lesson updated");
    onClose();
  };

  return (
    <Dialog open={Boolean(lesson)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit lesson</DialogTitle>
          <DialogDescription>{course?.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Title" htmlFor="l-title" required error={errors.title?.message}>
            <Input id="l-title" {...register("title")} />
          </FormField>
          <FormField label="Description" htmlFor="l-desc" required error={errors.description?.message}>
            <Textarea id="l-desc" rows={3} {...register("description")} />
          </FormField>
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <FormField label="Minutes" htmlFor="l-min" required error={errors.minutes?.message}>
              <Input id="l-min" type="number" min={1} {...register("minutes")} />
            </FormField>
            <FormField label="Video URL" htmlFor="l-url" required error={errors.videoUrl?.message}>
              <Input id="l-url" {...register("videoUrl")} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={watch("isPreview")} onCheckedChange={(v) => setValue("isPreview", Boolean(v))} /> Free preview (visible before
            purchase)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save lesson
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

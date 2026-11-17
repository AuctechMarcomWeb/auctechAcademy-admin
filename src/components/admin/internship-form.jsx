"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagInput } from "./tag-input";
import { internshipService } from "@/services/internship.service";
import { slugify, uid } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(5, "Title is required"),
  department: z.string().min(2, "Department is required"),
  description: z.string().min(30, "Describe the internship (30+ characters)"),
  durationWeeks: z.coerce.number().min(1).max(52),
  workMode: z.enum(["Remote", "Hybrid", "On-site"]),
  stipend: z.enum(["Paid", "Unpaid", "Performance-based"]),
  stipendAmount: z.coerce.number().min(0),
  applicationDeadline: z.string().min(1, "Deadline is required"),
  startDate: z.string().min(1, "Start date is required"),
  openings: z.coerce.number().min(1).max(100),
  mentorName: z.string().min(2, "Mentor is required"),
  mentorTitle: z.string().min(2, "Mentor title is required"),
  status: z.enum(["open", "closed"]),
  eligibility: z.array(z.string()).min(1, "Add at least one eligibility criterion"),
  skillsRequired: z.array(z.string()).min(1, "Add at least one skill"),
  learningOutcomes: z.array(z.string()).min(1, "Add at least one outcome"),
});

const toDateInput = (iso) => (iso ? iso.slice(0, 10) : "");

function toValues(i) {
  return {
    title: i?.title ?? "",
    department: i?.department ?? "",
    description: i?.description ?? "",
    durationWeeks: i?.durationWeeks ?? 8,
    workMode: i?.workMode ?? "Remote",
    stipend: i?.stipend ?? "Paid",
    stipendAmount: i?.stipendAmount ?? 0,
    applicationDeadline: toDateInput(i?.applicationDeadline),
    startDate: toDateInput(i?.startDate),
    openings: i?.openings ?? 2,
    mentorName: i?.mentorName ?? "",
    mentorTitle: i?.mentorTitle ?? "",
    status: i?.status ?? "open",
    eligibility: i?.eligibility ?? [],
    skillsRequired: i?.skillsRequired ?? [],
    learningOutcomes: i?.learningOutcomes ?? [],
  };
}

const THUMBS = { Engineering: "engineering", Marketing: "marketing", Analytics: "analytics", Design: "design", Infrastructure: "cloud" };

export function InternshipFormDialog({ internship, open, onClose }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: toValues(internship) });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  React.useEffect(() => {
    if (open) reset(toValues(internship));
  }, [open, internship, reset]);

  const onSubmit = async (v) => {
    const next = {
      id: internship?.id ?? uid("int"),
      slug: internship?.slug ?? slugify(v.title),
      thumbnail: internship?.thumbnail ?? `/thumbnails/internship-${THUMBS[v.department] ?? "engineering"}.svg`,
      ...v,
      stipendAmount: v.stipend === "Paid" ? v.stipendAmount : undefined,
      applicationDeadline: new Date(v.applicationDeadline).toISOString(),
      startDate: new Date(v.startDate).toISOString(),
    };
    await internshipService.save(next);
    toast.success(internship ? "Internship updated" : "Internship created");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{internship ? "Edit internship" : "Create internship"}</DialogTitle>
          <DialogDescription>Listed publicly under /internships while open and before the deadline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields"))} className="grid gap-4 md:grid-cols-2">
          <FormField label="Title" htmlFor="i-title" required error={errors.title?.message} className="md:col-span-2">
            <Input id="i-title" {...register("title")} />
          </FormField>
          <FormField label="Department" htmlFor="i-dept" required error={errors.department?.message}>
            <Input id="i-dept" {...register("department")} placeholder="Engineering" />
          </FormField>
          <FormField label="Status">
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v)}>
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Description" htmlFor="i-desc" required error={errors.description?.message} className="md:col-span-2">
            <Textarea id="i-desc" rows={3} {...register("description")} />
          </FormField>
          <FormField label="Duration (weeks)" htmlFor="i-dur" required error={errors.durationWeeks?.message}>
            <Input id="i-dur" type="number" min={1} {...register("durationWeeks")} />
          </FormField>
          <FormField label="Work mode">
            <Select value={watch("workMode")} onValueChange={(v) => setValue("workMode", v)}>
              <SelectTrigger aria-label="Work mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Remote", "Hybrid", "On-site"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Stipend">
            <Select value={watch("stipend")} onValueChange={(v) => setValue("stipend", v)}>
              <SelectTrigger aria-label="Stipend">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Paid", "Unpaid", "Performance-based"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Stipend amount (₹/month)" htmlFor="i-amt" error={errors.stipendAmount?.message}>
            <Input id="i-amt" type="number" min={0} disabled={watch("stipend") !== "Paid"} {...register("stipendAmount")} />
          </FormField>
          <FormField label="Application deadline" htmlFor="i-dead" required error={errors.applicationDeadline?.message}>
            <Input id="i-dead" type="date" {...register("applicationDeadline")} />
          </FormField>
          <FormField label="Start date" htmlFor="i-start" required error={errors.startDate?.message}>
            <Input id="i-start" type="date" {...register("startDate")} />
          </FormField>
          <FormField label="Openings" htmlFor="i-open" required error={errors.openings?.message}>
            <Input id="i-open" type="number" min={1} {...register("openings")} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mentor" htmlFor="i-mentor" required error={errors.mentorName?.message}>
              <Input id="i-mentor" {...register("mentorName")} />
            </FormField>
            <FormField label="Mentor title" htmlFor="i-mtitle" required error={errors.mentorTitle?.message}>
              <Input id="i-mtitle" {...register("mentorTitle")} />
            </FormField>
          </div>
          <FormField label="Eligibility" required error={errors.eligibility?.message} className="md:col-span-2">
            <TagInput value={watch("eligibility")} onChange={(v) => setValue("eligibility", v, { shouldValidate: true })} />
          </FormField>
          <FormField label="Skills required" required error={errors.skillsRequired?.message} className="md:col-span-2">
            <TagInput value={watch("skillsRequired")} onChange={(v) => setValue("skillsRequired", v, { shouldValidate: true })} />
          </FormField>
          <FormField label="Learning outcomes" required error={errors.learningOutcomes?.message} className="md:col-span-2">
            <TagInput value={watch("learningOutcomes")} onChange={(v) => setValue("learningOutcomes", v, { shouldValidate: true })} />
          </FormField>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {internship ? "Save changes" : "Create internship"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

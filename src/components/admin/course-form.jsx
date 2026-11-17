"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, ClipboardList, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buildQuiz, SAMPLE_VIDEOS } from "@/data/builders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { TagInput } from "./tag-input";
import { useDb } from "@/store/db.store";
import { courseService } from "@/services/course.service";
import { ApiError } from "@/services/api-client";
import { uploadService } from "@/services/upload.service";
import { slugify, uid } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const lessonSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Lesson title is required"),
  minutes: z.coerce.number().min(1, "At least 1 minute").max(600),
  videoUrl: z.string().url("Enter a valid video URL"),
  isPreview: z.boolean(),
});

const moduleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Module title is required"),
  description: z.string().optional(),
  hasQuiz: z.boolean(),
  passingScore: z.coerce.number().min(1).max(100),
  isFinalAssessment: z.boolean(),
  lessons: z.array(lessonSchema).min(1, "Add at least one lesson"),
});

const schema = z
  .object({
    title: z.string().min(5, "Title should be at least 5 characters"),
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
    subtitle: z.string().min(10, "Add a short subtitle"),
    description: z.string().min(40, "Describe the course in at least 40 characters"),
    categoryId: z.string().min(1, "Choose a category"),
    instructorId: z.string().min(1, "Choose an instructor"),
    level: z.enum(["Beginner", "Intermediate", "Advanced"]),
    language: z.string().min(2),
    certificateCode: z
      .string()
      .min(2)
      .max(6)
      .regex(/^[A-Z]+$/, "2–6 uppercase letters"),
    price: z.coerce.number().min(0),
    originalPrice: z.coerce.number().min(0),
    thumbnail: z.string().min(1, "Choose a thumbnail"),
    outcomes: z.array(z.string()).min(1, "Add at least one outcome"),
    skills: z.array(z.string()).min(1, "Add at least one skill"),
    prerequisites: z.array(z.string()),
    status: z.enum(["draft", "published", "archived"]),
    isFeatured: z.boolean(),
    modules: z.array(moduleSchema).min(1, "Add at least one module"),
  })
  .refine((v) => v.originalPrice === 0 || v.originalPrice >= v.price, { path: ["originalPrice"], message: "Original price must be ≥ price" });

const THUMBNAILS = [
  "full-stack-web-development",
  "digital-marketing-mastery",
  "python-for-data-analytics",
  "seo-fundamentals-to-advanced",
  "graphic-design-and-brand-identity",
  "aws-cloud-and-devops-essentials",
  "java-programming-and-dsa",
  "project-management-essentials",
  "machine-learning-with-python",
  "social-media-marketing",
  "linux-and-networking-fundamentals",
  "ui-ux-design-with-figma",
  "advanced-react-patterns",
].map((s) => `/thumbnails/${s}.svg`);

function toFormValues(course, quizzes = []) {
  if (!course) {
    return {
      title: "",
      slug: "",
      subtitle: "",
      description: "",
      categoryId: "",
      instructorId: "",
      level: "Beginner",
      language: "English",
      certificateCode: "",
      price: 2999,
      originalPrice: 6999,
      thumbnail: THUMBNAILS[0],
      outcomes: [],
      skills: [],
      prerequisites: [],
      status: "draft",
      isFeatured: false,
      modules: [
        {
          title: "Module 1",
          description: "",
          hasQuiz: true,
          passingScore: 70,
          isFinalAssessment: false,
          lessons: [{ title: "", minutes: 10, videoUrl: SAMPLE_VIDEOS[0], isPreview: true }],
        },
      ],
    };
  }
  return {
    title: course.title,
    slug: course.slug,
    subtitle: course.subtitle,
    description: course.description,
    categoryId: course.categoryId,
    instructorId: course.instructorId,
    level: course.level,
    language: course.language,
    certificateCode: course.certificateCode,
    price: course.price,
    originalPrice: course.originalPrice,
    thumbnail: course.thumbnail,
    outcomes: course.outcomes,
    skills: course.skills,
    prerequisites: course.prerequisites,
    status: course.status,
    isFeatured: Boolean(course.isFeatured),
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      hasQuiz: Boolean(m.quizId),
      passingScore: quizzes.find((q) => q.id === m.quizId)?.passingScore ?? 70,
      isFinalAssessment: Boolean(m.isFinalAssessment),
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        minutes: Math.round(l.durationSeconds / 60),
        videoUrl: l.videoUrl,
        isPreview: Boolean(l.isPreview),
      })),
    })),
  };
}

export function CourseForm({ course }) {
  const router = useRouter();
  const categories = useDb((s) => s.categories);
  const instructors = useDb((s) => s.instructors);
  const quizzes = useDb((s) => s.quizzes);
  const assignments = useDb((s) => s.assignments);
  const [uploadPreview, setUploadPreview] = React.useState(null);
  const [uploadFile, setUploadFile] = React.useState(null);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: toFormValues(course, quizzes), mode: "onBlur" });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;
  const modules = useFieldArray({ control, name: "modules" });
  const title = useWatch({ control, name: "title" });
  const price = useWatch({ control, name: "price" });
  const originalPrice = useWatch({ control, name: "originalPrice" });
  const thumbnail = useWatch({ control, name: "thumbnail" });

  // Slug follows the title until the admin edits the slug manually.
  React.useEffect(() => {
    if (!course && !dirtyFields.slug) setValue("slug", slugify(title ?? ""));
  }, [title, course, dirtyFields.slug, setValue]);

  const discount = originalPrice > price && originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  const onSubmit = async (values) => {
    const courseId = course?.id ?? uid("crs");
    const now = new Date().toISOString();
    const existingQuizzes = quizzes.filter((q) => q.courseId === courseId);
    const pendingQuizzes = [];

    const builtModules = values.modules.map((m, mi) => {
      const moduleId = m.id ?? `${courseId}_m${mi + 1}_${uid("").slice(4, 8)}`;
      const existing = course?.modules.find((x) => x.id === moduleId);
      const lessons = m.lessons.map((l, li) => {
        const prev = existing?.lessons.find((x) => x.id === l.id);
        return {
          id: l.id ?? `${moduleId}_l${li + 1}_${uid("").slice(4, 8)}`,
          moduleId,
          title: l.title,
          description:
            prev?.description ?? `In this lesson you will work through ${l.title.toLowerCase()} with a guided walkthrough and practical examples.`,
          videoUrl: l.videoUrl,
          durationSeconds: l.minutes * 60,
          order: li + 1,
          isPreview: l.isPreview,
          resources: prev?.resources ?? [],
        };
      });
      let quizId = existing?.quizId;
      if (m.hasQuiz) {
        const existingQuiz = quizId ? existingQuizzes.find((q) => q.id === quizId) : undefined;
        if (existingQuiz) {
          if (existingQuiz.passingScore !== m.passingScore) pendingQuizzes.push({ ...existingQuiz, passingScore: m.passingScore });
        } else {
          const quiz = buildQuiz(courseId, moduleId, `${m.title} Quiz`, { questions: [], passingScore: m.passingScore });
          pendingQuizzes.push(quiz);
          quizId = quiz.id;
        }
      } else {
        quizId = undefined;
      }
      return {
        id: moduleId,
        courseId,
        title: m.title,
        description: m.description || `Build a solid foundation in ${m.title.toLowerCase()}.`,
        order: mi + 1,
        lessons,
        quizId,
        assignmentId: existing?.assignmentId && assignments.some((a) => a.id === existing.assignmentId) ? existing.assignmentId : undefined,
        isFinalAssessment: m.isFinalAssessment || undefined,
      };
    });

    const next = {
      id: courseId,
      slug: values.slug,
      title: values.title,
      subtitle: values.subtitle,
      description: values.description,
      categoryId: values.categoryId,
      instructorId: values.instructorId,
      thumbnail: values.thumbnail,
      level: values.level,
      language: values.language,
      price: values.price,
      originalPrice: values.originalPrice || values.price,
      rating: course?.rating ?? 0,
      ratingCount: course?.ratingCount ?? 0,
      enrolledCount: course?.enrolledCount ?? 0,
      modules: builtModules,
      outcomes: values.outcomes,
      skills: values.skills,
      prerequisites: values.prerequisites,
      faqs: course?.faqs ?? [],
      certificateCode: values.certificateCode,
      status: values.status,
      isFeatured: values.isFeatured,
      createdAt: course?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      if (uploadFile) next.thumbnail = (await uploadService.upload(uploadFile, "thumbnail")).url;
      await courseService.save(next);
      // Quizzes are saved after the course so the server can link them to their modules.
      for (const q of pendingQuizzes) await courseService.saveQuiz(q);
      toast.success(course ? "Course updated" : "Course created");
      router.push(ROUTES.admin.courses);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the course");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields"))} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>What the course is and who teaches it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Title" htmlFor="title" required error={errors.title?.message} className="md:col-span-2">
            <Input id="title" {...register("title")} placeholder="e.g. Full Stack Web Development" aria-invalid={!!errors.title} />
          </FormField>
          <FormField
            label="Slug"
            htmlFor="slug"
            required
            error={errors.slug?.message}
            hint={`Public URL: /courses/${useWatch({ control, name: "slug" }) || "…"}`}
          >
            <Input id="slug" {...register("slug")} aria-invalid={!!errors.slug} />
          </FormField>
          <FormField
            label="Certificate code"
            htmlFor="certificateCode"
            required
            error={errors.certificateCode?.message}
            hint="Used in certificate IDs, e.g. AUC-DM-2026-000124"
          >
            <Input
              id="certificateCode"
              {...register("certificateCode", { setValueAs: (v) => (v ?? "").toUpperCase().trim() })}
              placeholder="DM"
              className="uppercase"
              aria-invalid={!!errors.certificateCode}
            />
          </FormField>
          <FormField label="Subtitle" htmlFor="subtitle" required error={errors.subtitle?.message} className="md:col-span-2">
            <Input id="subtitle" {...register("subtitle")} aria-invalid={!!errors.subtitle} />
          </FormField>
          <FormField label="Description" htmlFor="description" required error={errors.description?.message} className="md:col-span-2">
            <Textarea id="description" rows={5} {...register("description")} aria-invalid={!!errors.description} />
          </FormField>
          <FormField label="Category" required error={errors.categoryId?.message}>
            <Select value={useWatch({ control, name: "categoryId" })} onValueChange={(v) => setValue("categoryId", v, { shouldValidate: true })}>
              <SelectTrigger aria-label="Category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Instructor" required error={errors.instructorId?.message}>
            <Select value={useWatch({ control, name: "instructorId" })} onValueChange={(v) => setValue("instructorId", v, { shouldValidate: true })}>
              <SelectTrigger aria-label="Instructor">
                <SelectValue placeholder="Choose an instructor" />
              </SelectTrigger>
              <SelectContent>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Level" required>
            <Select value={useWatch({ control, name: "level" })} onValueChange={(v) => setValue("level", v)}>
              <SelectTrigger aria-label="Level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Beginner", "Intermediate", "Advanced"].map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Language" htmlFor="language" required error={errors.language?.message}>
            <Input id="language" {...register("language")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Prices are in INR and shown to learners exclusive of GST (added at checkout).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FormField label="Price (₹)" htmlFor="price" required error={errors.price?.message}>
            <Input id="price" type="number" min={0} {...register("price")} aria-invalid={!!errors.price} />
          </FormField>
          <FormField
            label="Original price (₹)"
            htmlFor="originalPrice"
            error={errors.originalPrice?.message}
            hint="Shown struck-through when higher than the price"
          >
            <Input id="originalPrice" type="number" min={0} {...register("originalPrice")} aria-invalid={!!errors.originalPrice} />
          </FormField>
          <div className="flex flex-col justify-end">
            <p className="text-sm font-medium mb-1">Discount preview</p>
            <div className="rounded-md border border-border bg-muted/40 px-3 h-10 flex items-center gap-2 text-sm">
              {discount > 0 ? (
                <>
                  <Badge variant="accent">{discount}% off</Badge>
                  <span className="text-muted-foreground">Learners save ₹{(originalPrice - price).toLocaleString("en-IN")}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No discount</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media</CardTitle>
          <CardDescription>Choose a thumbnail from the library or upload your own image.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div>
            <p className="text-sm font-medium mb-2">Thumbnail library</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {THUMBNAILS.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => {
                    setValue("thumbnail", t, { shouldValidate: true });
                    setUploadPreview(null);
                    setUploadFile(null);
                  }}
                  className={cn(
                    "relative aspect-video overflow-hidden rounded-md border-2 cursor-pointer",
                    thumbnail === t && !uploadPreview ? "border-secondary ring-2 ring-secondary/30" : "border-transparent hover:border-border",
                  )}
                  aria-label={`Use thumbnail ${t}`}
                >
                  <Image src={t} alt="" fill className="object-cover" sizes="120px" />
                </button>
              ))}
            </div>
            {errors.thumbnail && <p className="text-xs text-destructive mt-1">{errors.thumbnail.message}</p>}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Upload thumbnail</p>
            <FileDropzone
              value={uploadFile}
              accept="image/png,image/jpeg,image/webp"
              maxSizeMb={2}
              hint="PNG, JPG or WebP · 16:9 · up to 2 MB"
              onChange={(f) => {
                setUploadFile(f);
                if (uploadPreview) URL.revokeObjectURL(uploadPreview);
                setUploadPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
            <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadPreview ?? thumbnail} alt="Thumbnail preview" className="h-full w-full object-cover" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Curriculum</CardTitle>
          <CardDescription>
            Modules unlock sequentially. Each module can end with a quiz; mark the last module as the final assessment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.modules?.root?.message && <p className="text-xs text-destructive">{errors.modules.root.message}</p>}
          {typeof errors.modules?.message === "string" && <p className="text-xs text-destructive">{errors.modules.message}</p>}
          {modules.fields.map((field, mi) => (
            <ModuleEditor
              key={field.id}
              index={mi}
              control={control}
              register={register}
              errors={errors}
              setValue={setValue}
              total={modules.fields.length}
              onMove={(dir) => modules.move(mi, mi + dir)}
              onRemove={() => modules.remove(mi)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              modules.append({
                title: `Module ${modules.fields.length + 1}`,
                description: "",
                hasQuiz: true,
                passingScore: 70,
                isFinalAssessment: false,
                lessons: [{ title: "", minutes: 10, videoUrl: SAMPLE_VIDEOS[modules.fields.length % SAMPLE_VIDEOS.length], isPreview: false }],
              })
            }
          >
            <Plus /> Add module
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outcomes, skills and prerequisites</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField label="Learning outcomes" required error={errors.outcomes?.message}>
            <TagInput
              value={useWatch({ control, name: "outcomes" })}
              onChange={(v) => setValue("outcomes", v, { shouldValidate: true })}
              placeholder="Add an outcome and press Enter"
            />
          </FormField>
          <FormField label="Skills covered" required error={errors.skills?.message}>
            <TagInput
              value={useWatch({ control, name: "skills" })}
              onChange={(v) => setValue("skills", v, { shouldValidate: true })}
              placeholder="e.g. React"
            />
          </FormField>
          <FormField label="Prerequisites" error={errors.prerequisites?.message}>
            <TagInput
              value={useWatch({ control, name: "prerequisites" })}
              onChange={(v) => setValue("prerequisites", v)}
              placeholder="e.g. Basic computer literacy"
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Status">
            <Select value={useWatch({ control, name: "status" })} onValueChange={(v) => setValue("status", v)}>
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-center gap-3 md:pt-6">
            <Switch id="featured" checked={useWatch({ control, name: "isFeatured" })} onCheckedChange={(v) => setValue("isFeatured", v)} />
            <Label htmlFor="featured">Feature on the homepage</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-0 bg-background/90 backdrop-blur py-3 border-t border-border">
        <Button type="button" variant="outline" onClick={() => router.push(ROUTES.admin.courses)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {course ? "Save changes" : "Create course"}
        </Button>
      </div>
    </form>
  );
}

function ModuleEditor({ index, control, register, errors, setValue, total, onMove, onRemove }) {
  const lessons = useFieldArray({ control, name: `modules.${index}.lessons` });
  const hasQuiz = useWatch({ control, name: `modules.${index}.hasQuiz` });
  const isFinal = useWatch({ control, name: `modules.${index}.isFinalAssessment` });
  const mErr = errors.modules?.[index];

  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module {index + 1}</span>
        {isFinal && <Badge variant="accent">Final assessment</Badge>}
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move module up">
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move module down">
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={total === 1}
            onClick={onRemove}
            aria-label="Remove module"
            className="text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="p-3 grid gap-3 md:grid-cols-2">
        <FormField label="Module title" required error={mErr?.title?.message}>
          <Input {...register(`modules.${index}.title`)} className="bg-card" aria-invalid={!!mErr?.title} />
        </FormField>
        <FormField label="Description">
          <Input {...register(`modules.${index}.description`)} className="bg-card" placeholder="Optional summary" />
        </FormField>
        <div className="md:col-span-2 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={hasQuiz} onCheckedChange={(v) => setValue(`modules.${index}.hasQuiz`, Boolean(v))} />
            <ClipboardList className="h-4 w-4 text-muted-foreground" /> Ends with a quiz
          </label>
          {hasQuiz && (
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor={`pass-${index}`}>Passing score %</Label>
              <Input
                id={`pass-${index}`}
                type="number"
                min={1}
                max={100}
                className="w-20 h-8 bg-card"
                {...register(`modules.${index}.passingScore`)}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={isFinal} onCheckedChange={(v) => setValue(`modules.${index}.isFinalAssessment`, Boolean(v))} /> Final assessment module
          </label>
        </div>

        <div className="md:col-span-2 space-y-2">
          <p className="text-sm font-medium">Lessons</p>
          {typeof mErr?.lessons?.message === "string" && <p className="text-xs text-destructive">{mErr.lessons.message}</p>}
          {lessons.fields.map((lf, li) => (
            <LessonRow
              key={lf.id}
              moduleIndex={index}
              lessonIndex={li}
              control={control}
              register={register}
              setValue={setValue}
              error={mErr?.lessons?.[li]}
              total={lessons.fields.length}
              onMove={(dir) => lessons.move(li, li + dir)}
              onRemove={() => lessons.remove(li)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              lessons.append({
                title: "",
                minutes: 10,
                videoUrl: SAMPLE_VIDEOS[(lessons.fields.length + index) % SAMPLE_VIDEOS.length],
                isPreview: false,
              })
            }
          >
            <Plus /> Add lesson
          </Button>
        </div>
      </div>
    </div>
  );
}

function LessonRow({ moduleIndex: index, lessonIndex: li, control, register, setValue, error: lErr, total, onMove, onRemove }) {
  const isPreview = useWatch({ control, name: `modules.${index}.lessons.${li}.isPreview` });
  return (
    <div className="grid gap-2 rounded-md border border-border bg-card p-2 md:grid-cols-[auto_1fr_90px_1.2fr_auto_auto] md:items-start">
      <span className="text-xs text-muted-foreground pt-3 w-6 text-center tabular-nums">{li + 1}.</span>
      <FormField error={lErr?.title?.message}>
        <Input {...register(`modules.${index}.lessons.${li}.title`)} placeholder="Lesson title" aria-invalid={!!lErr?.title} />
      </FormField>
      <FormField error={lErr?.minutes?.message}>
        <Input
          type="number"
          min={1}
          {...register(`modules.${index}.lessons.${li}.minutes`)}
          placeholder="min"
          aria-label="Minutes"
          aria-invalid={!!lErr?.minutes}
        />
      </FormField>
      <FormField error={lErr?.videoUrl?.message}>
        <Input
          {...register(`modules.${index}.lessons.${li}.videoUrl`)}
          placeholder="https://cdn…/video.mp4"
          aria-label="Video URL"
          aria-invalid={!!lErr?.videoUrl}
        />
      </FormField>
      <label className="flex items-center gap-1.5 text-xs pt-3 cursor-pointer whitespace-nowrap">
        <Checkbox checked={isPreview} onCheckedChange={(v) => setValue(`modules.${index}.lessons.${li}.isPreview`, Boolean(v))} /> Preview
      </label>
      <div className="flex items-center gap-0.5 pt-1">
        <Button type="button" variant="ghost" size="icon-sm" disabled={li === 0} onClick={() => onMove(-1)} aria-label="Move lesson up">
          <ArrowUp />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={li === total - 1} onClick={() => onMove(1)} aria-label="Move lesson down">
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={total === 1}
          onClick={onRemove}
          aria-label="Remove lesson"
          className="text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

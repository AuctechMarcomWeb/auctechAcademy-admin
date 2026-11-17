"use client";

import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { courseService } from "@/services/course.service";
import { uid } from "@/lib/utils";

const questionSchema = z.object({
  id: z.string().optional(),
  prompt: z.string().min(5, "Question text is required"),
  options: z.array(z.object({ id: z.string().optional(), text: z.string().min(1, "Required") })).length(4),
  correctIndex: z.coerce.number().min(0).max(3),
  explanation: z.string().optional(),
});

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().optional(),
  passingScore: z.coerce.number().min(1).max(100),
  timeLimitMinutes: z.coerce.number().min(0).max(240),
  maxAttempts: z.coerce.number().min(0).max(20),
  questions: z.array(questionSchema).min(1, "Add at least one question"),
});

function toValues(q) {
  return {
    title: q.title,
    description: q.description ?? "",
    passingScore: q.passingScore,
    timeLimitMinutes: q.timeLimitSeconds ? Math.round(q.timeLimitSeconds / 60) : 0,
    maxAttempts: q.maxAttempts ?? 0,
    questions: q.questions.map((qq) => ({
      id: qq.id,
      prompt: qq.prompt,
      options: [0, 1, 2, 3].map((i) => ({ id: qq.options[i]?.id, text: qq.options[i]?.text ?? "" })),
      correctIndex: Math.max(
        0,
        qq.options.findIndex((o) => o.id === qq.correctOptionId),
      ),
      explanation: qq.explanation ?? "",
    })),
  };
}

export function QuizEditorDialog({ quiz, onClose }) {
  const form = useForm({ resolver: zodResolver(schema) });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const questions = useFieldArray({ control, name: "questions" });

  React.useEffect(() => {
    if (quiz) reset(toValues(quiz));
  }, [quiz, reset]);

  const onSubmit = async (v) => {
    if (!quiz) return;
    const next = {
      ...quiz,
      title: v.title,
      description: v.description || undefined,
      passingScore: v.passingScore,
      timeLimitSeconds: v.timeLimitMinutes ? v.timeLimitMinutes * 60 : undefined,
      maxAttempts: v.maxAttempts || undefined,
      questions: v.questions.map((q, qi) => {
        const qid = q.id ?? `${quiz.moduleId}_q${qi + 1}_${uid("").slice(4, 8)}`;
        const options = q.options.map((o, oi) => ({ id: o.id ?? `${qid}_o${oi + 1}`, text: o.text }));
        return { id: qid, prompt: q.prompt, options, correctOptionId: options[q.correctIndex].id, explanation: q.explanation || undefined };
      }),
    };
    await courseService.saveQuiz(next);
    toast.success("Quiz saved");
    onClose();
  };

  return (
    <Dialog open={Boolean(quiz)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Edit quiz</DialogTitle>
          <DialogDescription>
            Single-correct-answer multiple choice. Learners must reach the passing score to unlock the next module.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields"))} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Title" htmlFor="q-title" required error={errors.title?.message} className="md:col-span-2">
              <Input id="q-title" {...register("title")} />
            </FormField>
            <FormField label="Description" htmlFor="q-desc" className="md:col-span-2">
              <Input id="q-desc" {...register("description")} />
            </FormField>
            <FormField label="Passing score (%)" htmlFor="q-pass" required error={errors.passingScore?.message}>
              <Input id="q-pass" type="number" min={1} max={100} {...register("passingScore")} />
            </FormField>
            <FormField label="Time limit (minutes, 0 = none)" htmlFor="q-time" error={errors.timeLimitMinutes?.message}>
              <Input id="q-time" type="number" min={0} {...register("timeLimitMinutes")} />
            </FormField>
            <FormField label="Max attempts (0 = unlimited)" htmlFor="q-att" error={errors.maxAttempts?.message}>
              <Input id="q-att" type="number" min={0} {...register("maxAttempts")} />
            </FormField>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Questions ({questions.fields.length})</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  questions.append({
                    prompt: "",
                    options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
                    correctIndex: 0,
                    explanation: "",
                  })
                }
              >
                <Plus /> Add question
              </Button>
            </div>
            {typeof errors.questions?.message === "string" && <p className="text-xs text-destructive">{errors.questions.message}</p>}
            {questions.fields.map((f, qi) => (
              <QuestionEditor
                key={f.id}
                index={qi}
                control={control}
                register={register}
                setValue={setValue}
                error={errors.questions?.[qi]}
                onRemove={() => questions.remove(qi)}
                canRemove={questions.fields.length > 1}
              />
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save quiz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuestionEditor({ index, control, register, setValue, error, onRemove, canRemove }) {
  const correct = useWatch({ control, name: `questions.${index}.correctIndex` });
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-xs font-semibold text-muted-foreground pt-3 w-8">Q{index + 1}</span>
        <FormField error={error?.prompt?.message} className="flex-1">
          <Textarea
            rows={2}
            {...register(`questions.${index}.prompt`)}
            placeholder="Question text"
            className="bg-card"
            aria-invalid={!!error?.prompt}
          />
        </FormField>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label="Remove question"
        >
          <Trash2 />
        </Button>
      </div>
      <RadioGroup
        value={String(correct)}
        onValueChange={(v) => setValue(`questions.${index}.correctIndex`, Number(v))}
        className="grid gap-2 md:grid-cols-2 pl-10"
      >
        {[0, 1, 2, 3].map((oi) => (
          <div key={oi} className="flex items-center gap-2">
            <RadioGroupItem value={String(oi)} id={`q${index}o${oi}`} aria-label={`Mark option ${oi + 1} correct`} />
            <Input
              {...register(`questions.${index}.options.${oi}.text`)}
              placeholder={`Option ${oi + 1}`}
              className="bg-card h-9"
              aria-invalid={!!error?.options?.[oi]?.text}
            />
          </div>
        ))}
      </RadioGroup>
      <div className="pl-10">
        <Input {...register(`questions.${index}.explanation`)} placeholder="Explanation shown after answering (optional)" className="bg-card h-9" />
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, useConfirm } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useDb } from "@/store/db.store";
import { useServerConfig } from "@/services/sync.service";
import { API_URL, ApiError } from "@/services/api-client";
import { adminService } from "@/services/admin.service";

const schema = z.object({
  siteName: z.string().min(2),
  supportEmail: z.string().email("Enter a valid email"),
  gstPercent: z.coerce.number().min(0).max(100),
  defaultPassingScore: z.coerce.number().min(1).max(100),
  watchThresholdPercent: z.coerce.number().min(50).max(100),
  certificatePrefix: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Z]+$/, "Uppercase letters only"),
  allowQuizRetakes: z.boolean(),
  maintenanceMode: z.boolean(),
});

export default function SettingsPage() {
  const settings = useDb((s) => s.settings);
  const config = useServerConfig((s) => s.config);
  const syncError = useDb((s) => s.syncError);
  const INTEGRATIONS = [
    {
      name: "Backend API",
      env: `NEXT_PUBLIC_API_URL = ${API_URL}`,
      configured: !syncError,
      note: "Node/Express + MongoDB server this portal talks to.",
    },
    {
      name: "Razorpay",
      env: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (backend .env)",
      configured: config?.paymentMode === "razorpay",
      note:
        config?.paymentMode === "razorpay"
          ? "Live/test keys configured — real checkout is used."
          : "Not set — checkout uses the simulated payment dialog.",
    },
    {
      name: "Google sign-in",
      env: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (backend .env)",
      configured: Boolean(config?.googleEnabled),
      note: "OAuth runs on the backend; students see the Google button when set.",
    },
  ];
  const confirm = useConfirm();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: settings });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  useEffect(() => reset(settings), [settings, reset]);

  const onSubmit = async (v) => {
    try {
      await adminService.updateSettings(v);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save settings");
    }
  };

  const resetDemo = async () => {
    confirm.setBusy(true);
    try {
      await adminService.resetDemoData();
      toast.success("Database reset to the demo dataset");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Reset failed");
    } finally {
      confirm.close();
    }
  };

  return (
    <AdminPage title="Settings" description="Platform-wide defaults, integrations and demo controls.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Site name" htmlFor="siteName" required error={errors.siteName?.message}>
              <Input id="siteName" {...register("siteName")} />
            </FormField>
            <FormField label="Support email" htmlFor="supportEmail" required error={errors.supportEmail?.message}>
              <Input id="supportEmail" type="email" {...register("supportEmail")} />
            </FormField>
            <FormField label="GST (%)" htmlFor="gst" required error={errors.gstPercent?.message} hint="Applied at checkout on the discounted price.">
              <Input id="gst" type="number" min={0} max={100} {...register("gstPercent")} />
            </FormField>
            <FormField
              label="Certificate prefix"
              htmlFor="prefix"
              required
              error={errors.certificatePrefix?.message}
              hint="IDs look like PREFIX-CODE-YYYY-000001"
            >
              <Input id="prefix" className="uppercase" {...register("certificatePrefix", { setValueAs: (v) => (v ?? "").toUpperCase().trim() })} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Learning rules</CardTitle>
            <CardDescription>Defaults applied to new courses. The backend enforces these when verifying playback and grading.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Default quiz passing score (%)" htmlFor="pass" required error={errors.defaultPassingScore?.message}>
              <Input id="pass" type="number" min={1} max={100} {...register("defaultPassingScore")} />
            </FormField>
            <FormField
              label="Video watch threshold (%)"
              htmlFor="watch"
              required
              error={errors.watchThresholdPercent?.message}
              hint="Share of a video that must be watched before a lesson can be marked complete."
            >
              <Input id="watch" type="number" min={50} max={100} {...register("watchThresholdPercent")} />
            </FormField>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="retakes">Allow quiz retakes</Label>
                <p className="text-xs text-muted-foreground">Learners can retry failed quizzes until they pass.</p>
              </div>
              <Switch
                id="retakes"
                checked={watch("allowQuizRetakes")}
                onCheckedChange={(v) => setValue("allowQuizRetakes", v, { shouldDirty: true })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="maint">Maintenance mode</Label>
                <p className="text-xs text-muted-foreground">Shows a maintenance notice on the public site.</p>
              </div>
              <Switch id="maint" checked={watch("maintenanceMode")} onCheckedChange={(v) => setValue("maintenanceMode", v, { shouldDirty: true })} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => reset(settings)} disabled={!isDirty}>
            Discard
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save settings
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-secondary" /> Integrations
          </CardTitle>
          <CardDescription>Secrets live in the backend&apos;s .env file and never reach the browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {INTEGRATIONS.map((i) => (
              <li key={i.env} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{i.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>{i.env}</code> — {i.note}
                  </p>
                </div>
                {i.configured ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" /> Configured
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <XCircle className="h-3 w-3" /> Not configured
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {config?.demoReset && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </CardTitle>
            <CardDescription>
              Wipes the MongoDB database and restores the seeded demo catalogue, users, orders, certificates and learner progress. Disable with
              ALLOW_DEMO_RESET=false on the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => confirm.ask()}>
              Reset demo data
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title="Reset all demo data?"
        description="Every record in the database — courses, users, enrollments, orders, certificates, learner progress — will be deleted and the original demo dataset restored. This cannot be undone."
        confirmLabel="Reset everything"
        destructive
        loading={confirm.busy}
        onConfirm={resetDemo}
      />
    </AdminPage>
  );
}

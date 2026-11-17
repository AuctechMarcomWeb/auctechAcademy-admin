"use client";

import { AdminPage } from "@/components/admin/admin-page";
import { CourseForm } from "@/components/admin/course-form";

export default function CreateCoursePage() {
  return (
    <AdminPage title="Create course" description="Set up the basics, pricing, media and curriculum. You can save as a draft and publish later.">
      <CourseForm />
    </AdminPage>
  );
}

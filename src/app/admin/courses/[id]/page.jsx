"use client";

import { use } from "react";
import Link from "next/link";
import { BookX } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { CourseForm } from "@/components/admin/course-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useDb } from "@/store/db.store";
import { ROUTES } from "@/lib/constants";

export default function EditCoursePage({ params }) {
  const { id } = use(params);
  const course = useDb((s) => s.courses.find((c) => c.id === id));

  return (
    <AdminPage
      title={course ? `Edit: ${course.title}` : "Edit course"}
      description={course ? `Last updated ${new Date(course.updatedAt).toLocaleDateString("en-IN")}` : undefined}
    >
      {course ? (
        <CourseForm key={course.id} course={course} />
      ) : (
        <EmptyState
          icon={BookX}
          title="Course not found"
          description="It may have been deleted or the link is incorrect."
          action={
            <Button asChild>
              <Link href={ROUTES.admin.courses}>Back to courses</Link>
            </Button>
          }
        />
      )}
    </AdminPage>
  );
}

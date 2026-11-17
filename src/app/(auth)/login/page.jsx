import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Spinner } from "@/components/shared/loading";
import { FRONTEND_URL } from "@/lib/constants";

export const metadata = { title: "Admin sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthCard
      title="Admin Portal"
      subtitle="Sign in with an administrator account"
      footer={
        <>
          Looking for the learning site?{" "}
          <a href={FRONTEND_URL} className="font-medium text-secondary hover:underline">
            Go to Auctech Academy
          </a>
        </>
      }
    >
      <Suspense fallback={<Spinner />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}

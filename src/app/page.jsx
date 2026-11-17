import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

/** The admin app has no public pages: send visitors to the dashboard (the guard handles sign-in). */
export default function Home() {
  redirect(ROUTES.admin.dashboard);
}

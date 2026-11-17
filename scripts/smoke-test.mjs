/**
 * End-to-end smoke test for the admin portal against a running backend.
 *   backend: npm run seed && npm start        (http://localhost:5000)
 *   admin:   npm run build && npm run start   (http://localhost:3001)
 *   node scripts/smoke-test.mjs
 */
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const API = (process.env.API_URL ?? "http://localhost:5000") + "/api";
const ADMIN = { email: "admin@auctech.in", password: "password123" };
const STUDENT = { email: "student@auctech.in", password: "password123" };

const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/courses",
  "/admin/courses/create",
  "/admin/courses/crs_fullstack",
  "/admin/categories",
  "/admin/modules",
  "/admin/lessons",
  "/admin/videos",
  "/admin/students",
  "/admin/enrollments",
  "/admin/orders",
  "/admin/quizzes",
  "/admin/assignments",
  "/admin/internships",
  "/admin/certificates",
  "/admin/analytics",
  "/admin/settings",
];
const IGNORED_CONSOLE = [/Failed to load resource/, /net::ERR/, /favicon/, /hydration/i];

let failures = 0;
const check = (cond, msg) => {
  if (!cond) failures += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
};

async function login(page, { email, password }) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}
const token = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("auctech.session") ?? "{}").state?.token);
async function api(page, path, init = {}) {
  const t = await token(page);
  const res = await fetch(API + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && !IGNORED_CONSOLE.some((r) => r.test(m.text())) && consoleErrors.push(`${page.url()}: ${m.text()}`));
page.on("pageerror", (e) => consoleErrors.push(`${page.url()}: ${e.message}`));

console.log("\nAccess control");
await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});
check(page.url().includes("/login"), `unauthenticated / → ${new URL(page.url()).pathname}`);
await login(page, STUDENT);
await page.waitForTimeout(1500);
check(
  (
    await page
      .locator('[role="alert"]')
      .first()
      .innerText()
      .catch(() => "")
  )
    .toLowerCase()
    .includes("for administrators"),
  "student account is refused by the admin portal",
);
await login(page, ADMIN);
await page.waitForURL(/\/admin\//, { timeout: 15000 });
check(page.url().includes("/admin/dashboard"), `admin landed on ${new URL(page.url()).pathname}`);

console.log("\nAdmin routes");
for (const r of ADMIN_ROUTES) {
  const res = await page.goto(BASE + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const text = await page
    .locator("main")
    .innerText()
    .catch(() => "");
  check(res?.status() === 200 && !/Application error|Unhandled Runtime Error/.test(text), `${r} → ${res?.status()}`);
}

console.log("\nDashboard numbers come from MongoDB");
const stats = (await api(page, "/admin/stats")).body;
await page.goto(BASE + "/admin/dashboard", { waitUntil: "networkidle" });
const dash = await page.locator("main").innerText();
check(stats && dash.includes(String(stats.totalStudents)), `dashboard shows ${stats?.totalStudents} students (API /admin/stats)`);

console.log("\nCategories: create through the UI, stored on the server");
await page.goto(BASE + "/admin/categories", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /add category/i }).click();
const slug = `smoke-${Date.now()}`;
await page.locator("#cat-name").fill("Smoke Test Category");
await page.locator("#cat-slug").fill(slug);
await page.locator("#cat-desc").fill("Created by the admin smoke test.");
await page.getByRole("dialog").locator('button[type="submit"]').click();
await page.waitForTimeout(1200);
const cats = await (await fetch(API + "/categories")).json();
check(
  cats.some((c) => c.slug === slug),
  "new category returned by GET /api/categories",
);

console.log("\nCertificates: revoke + reinstate");
const certId = "AUC-JAVA-2026-000071";
await page.goto(BASE + "/admin/certificates", { waitUntil: "networkidle" });
const row = page.locator("tr", { hasText: certId });
await row.getByRole("button", { name: /details/i }).click();
await page.getByRole("button", { name: /^revoke$/i }).click();
await page.locator("#revoke-reason").fill("Smoke test revocation");
await page.getByRole("button", { name: /revoke certificate/i }).click();
await page.waitForTimeout(1200);
let v = await (await fetch(`${API}/certificates/verify/${certId}`)).json();
check(v.status === "revoked", `public verification now says ${v.status}`);
const reinstate = await api(page, `/admin/certificates/${certId}/reinstate`, { method: "POST", body: "{}" });
v = await (await fetch(`${API}/certificates/verify/${certId}`)).json();
check(reinstate.status === 200 && v.status === "valid", "reinstated → valid");

console.log("\nSettings: save through the UI");
await page.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
await page.locator("#siteName").fill("Auctech Academy");
await page.locator("#gst").fill("18");
await page.locator("#supportEmail").fill("support@auctech.in");
await page.getByRole("button", { name: /save settings/i }).click();
await page.waitForTimeout(1200);
const settings = (await api(page, "/admin/settings")).body;
check(settings?.supportEmail === "support@auctech.in", "settings persisted on the server");
await api(page, "/admin/settings", { method: "PUT", body: JSON.stringify({ supportEmail: "academy@auctech.in" }) });

console.log("\nSecurity: student token cannot call admin APIs");
const st = await (
  await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(STUDENT) })
).json();
const forbidden = await fetch(API + "/admin/users", { headers: { Authorization: `Bearer ${st.token}` } });
check(forbidden.status === 403, `GET /api/admin/users as student → ${forbidden.status}`);

console.log("\nLogout");
await page.goto(BASE + "/admin/dashboard", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("auctech.session"));
await page.goto(BASE + "/admin/orders", { waitUntil: "networkidle" });
await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});
check(page.url().includes("/login"), "signed-out admin is sent to /login");

console.log("\nConsole errors");
check(
  consoleErrors.length === 0,
  consoleErrors.length ? `${consoleErrors.length} console errors:\n    ${consoleErrors.slice(0, 8).join("\n    ")}` : "no console errors",
);

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll admin checks passed");
process.exit(failures ? 1 : 0);

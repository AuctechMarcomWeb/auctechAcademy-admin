/**
 * Extra end-to-end checks for the admin portal (run on a seeded backend, after smoke-test.mjs):
 * course creation, quiz editor, internship form, assignment review, refunds,
 * suspending students and video upload — each verified against the API.
 *   node scripts/deep-test.mjs
 */
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const API = (process.env.API_URL ?? "http://localhost:5000") + "/api";

let failures = 0;
const check = (cond, msg) => {
  if (!cond) failures += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(BASE + "/login", { waitUntil: "load" });
await page.getByTestId("login-email").fill("admin@auctech.in");
await page.getByTestId("login-password").fill("password123");
await page.getByTestId("login-submit").click();
await page.waitForURL(/\/admin\//, { timeout: 15000 });
const token = await page.evaluate(() => JSON.parse(localStorage.getItem("auctech.session")).state.token);
const api = async (path, init = {}) => {
  const res = await fetch(API + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const pickOption = async (triggerLabel, optionText) => {
  await page.getByRole("combobox", { name: triggerLabel }).click();
  await page.getByRole("option", { name: optionText }).click();
};
const addTag = async (placeholder, value) => {
  const input = page.locator(`input[placeholder="${placeholder}"]`).first();
  await input.fill(value);
  await input.press("Enter");
};

/* ---------- Course creation ---------- */
console.log("\nCreate a course from the form");
await page.goto(BASE + "/admin/courses/create", { waitUntil: "networkidle" });
const stamp = Date.now() % 100000;
const title = `Excel for Business ${stamp}`;
await page.locator("#title").fill(title);
await page.locator("#certificateCode").fill("xl"); // lowercase on purpose: should be accepted
await page.locator("#subtitle").fill("Formulas, pivots and dashboards for everyday work.");
await page.locator("#description").fill("A practical course on spreadsheets: clean data, write formulas, build pivots and present dashboards.");
await pickOption("Category", "Business & Management");
await pickOption("Instructor", /Nisha Verma/);
await page.locator("#price").fill("1999");
await page.locator("#originalPrice").fill("3999");
await addTag("Add an outcome and press Enter", "Build a sales dashboard");
await addTag("e.g. React", "Excel");
await page.locator('input[placeholder="Lesson title"]').first().fill("Getting around Excel");
await page.getByRole("button", { name: /create course/i }).click();
await page.waitForURL(/\/admin\/courses$/, { timeout: 15000 }).catch(() => {});
const courses = (await api("/admin/courses")).body ?? [];
const created = courses.find((c) => c.title === title);
check(Boolean(created), "course stored in MongoDB");
check(created?.certificateCode === "XL", `certificate code saved in capitals (${created?.certificateCode})`);
const quizId = created?.modules?.[0]?.quizId;
check(Boolean(quizId), "module quiz created and linked to the module");

/* ---------- Quiz editor ---------- */
console.log("\nQuiz editor");
await page.goto(BASE + "/admin/quizzes", { waitUntil: "networkidle" });
await pickOption("Course filter", title);
await page.locator("tr", { hasText: "Module 1 Quiz" }).getByRole("button", { name: "Edit quiz" }).first().click();
const dlg = page.getByRole("dialog");
// New module quizzes start with five template questions; edit the first one.
await dlg.locator('textarea[placeholder="Question text"]').first().fill("Which function adds a range of cells?");
for (const [i, t] of ["SUM", "COUNT", "AVERAGE", "MAX"].entries())
  await dlg
    .locator(`input[placeholder="Option ${i + 1}"]`)
    .first()
    .fill(t);
await dlg.getByLabel("Mark option 1 correct").first().click();
await dlg.getByRole("button", { name: /save quiz/i }).click();
await page.waitForTimeout(1500);
const quiz = ((await api("/admin/quizzes")).body ?? []).find((q) => q.id === quizId);
check(
  quiz?.questions?.length >= 1 && quiz.questions[0].options.find((o) => o.id === quiz.questions[0].correctOptionId)?.text === "SUM",
  "question with correct answer saved",
);

/* ---------- Publish + visible on the website API ---------- */
await api(`/admin/courses/${created?.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "published" }) });
const pub = await (await fetch(`${API}/courses/slug/${created?.slug}`)).json();
check(pub?.title === title, "published course is served to the website");

/* ---------- Internship form ---------- */
console.log("\nCreate an internship");
await page.goto(BASE + "/admin/internships", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /create internship/i }).click();
const iTitle = `QA Automation Internship ${stamp}`;
await page.locator("#i-title").fill(iTitle);
await page.locator("#i-dept").fill("Engineering");
await page.locator("#i-desc").fill("Write automated browser tests for the learning platform with our QA lead.");
await page.locator("#i-dead").fill(new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10));
await page.locator("#i-start").fill(new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10));
await page.locator("#i-mentor").fill("Arjun Mehta");
await page.locator("#i-mtitle").fill("Senior Engineer");
const tagInputs = page.getByRole("dialog").locator("input:not([id])");
const n = await tagInputs.count();
for (let i = 0; i < n; i++) {
  await tagInputs.nth(i).fill(["Basic JavaScript", "Playwright", "Ship a test suite"][i] ?? "Extra");
  await tagInputs.nth(i).press("Enter");
}
await page
  .getByRole("dialog")
  .getByRole("button", { name: /create internship/i })
  .click();
await page.waitForTimeout(1500);
const internships = await (await fetch(API + "/internships")).json();
check(
  internships.some((i) => i.title === iTitle),
  "internship stored and public",
);

/* ---------- Assignment review ---------- */
console.log("\nReview an assignment submission");
await page.goto(BASE + "/admin/assignments", { waitUntil: "networkidle" });
await page
  .locator("tr", { hasText: "Portfolio" })
  .getByRole("button", { name: /review/i })
  .first()
  .click();
await pickOption("Decision", /approve/i);
await page.locator("#marks").fill("88");
await page.locator("#feedback").fill("Clean structure and a well-documented README. Great work.");
await page.getByRole("button", { name: /save review/i }).click();
await page.waitForTimeout(1500);
const subs = (await api("/admin/submissions")).body ?? [];
const reviewed = subs.find((s) => s.id === "sub_2");
check(reviewed?.status === "approved" && reviewed?.marks === 88, `submission approved with marks (${reviewed?.status}, ${reviewed?.marks})`);

/* ---------- Refund from the orders page ---------- */
console.log("\nRefund an order");
await page.goto(BASE + "/admin/orders", { waitUntil: "networkidle" });
await page
  .locator("tr", { hasText: "AUC-ORD-10139" })
  .getByRole("button", { name: /details/i })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: /refund/i })
  .click();
await page
  .getByRole("alertdialog")
  .getByRole("button", { name: /refund/i })
  .click();
await page.waitForTimeout(1500);
const orders = (await api("/admin/orders")).body ?? [];
check(orders.find((o) => o.orderNumber === "AUC-ORD-10139")?.status === "refunded", "order refunded");
const enr = (await api("/admin/enrollments")).body ?? [];
check(enr.find((e) => e.orderId === "ord_13")?.status === "refunded", "linked enrollment revoked");

/* ---------- Suspend / reactivate ---------- */
console.log("\nSuspend and reactivate a student");
await page.goto(BASE + "/admin/students", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Actions for Neha Joshi" }).click();
await page.getByRole("menuitem", { name: /suspend/i }).click();
await page.getByRole("alertdialog").getByRole("button").last().click();
await page.waitForTimeout(1200);
let neha = ((await api("/admin/users")).body ?? []).find((u) => u.name === "Neha Joshi");
check(neha?.status === "suspended", "student suspended");
const blocked = await fetch(API + "/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "neha.joshi@example.com", password: "password123" }),
});
check(blocked.status === 403, "suspended student cannot sign in");
await page.getByRole("button", { name: "Actions for Neha Joshi" }).click();
await page.getByRole("menuitem", { name: /reactivate/i }).click();
await page.getByRole("alertdialog").getByRole("button").last().click();
await page.waitForTimeout(1200);
neha = ((await api("/admin/users")).body ?? []).find((u) => u.name === "Neha Joshi");
check(neha?.status === "active", "student reactivated");

/* ---------- Video upload ---------- */
console.log("\nUpload a lesson video");
await page.goto(BASE + "/admin/videos", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /upload video/i }).click();
await page.locator("#video-upload").setInputFiles({ name: "intro.webm", mimeType: "video/webm", buffer: Buffer.from("WEBM-TEST-BYTES") });
await page.getByRole("combobox", { name: "Lesson" }).click();
await page.getByRole("option", { name: new RegExp(`${title}.*Getting around Excel`) }).click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: /^upload/i })
  .click();
await page.waitForTimeout(2000);
const after = ((await api("/admin/courses")).body ?? []).find((c) => c.id === created?.id);
const videoUrl = after?.modules?.[0]?.lessons?.[0]?.videoUrl ?? "";
check(videoUrl.includes("/uploads/public/"), "lesson now points at the uploaded file");
if (videoUrl) {
  const v = await fetch(videoUrl);
  check(v.status === 200 && (await v.text()) === "WEBM-TEST-BYTES", "uploaded video is served by the API");
}

/* ---------- Clean up the course ---------- */
const del = await api(`/admin/courses/${created?.id}`, { method: "DELETE" });
check(del.status === 200, "test course deleted");

console.log("\nPage errors");
check(errors.length === 0, errors.length ? errors.slice(0, 5).join(" | ") : "no uncaught page errors");
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll admin deep checks passed");
process.exit(failures ? 1 : 0);

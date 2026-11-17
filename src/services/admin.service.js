import { useDb } from "@/store/db.store";
import { api } from "./api-client";
import { syncService } from "./sync.service";

/**
 * Admin dashboards compute their numbers from the cached collections (the
 * admin sync contains everything). `adminService.stats()` returns the same
 * figures computed by the server.
 */

export function computeAdminStats(db) {
  const students = db.users.filter((u) => u.role === "student");
  const paid = db.orders.filter((o) => o.status === "successful");
  const activeEnrollments = db.enrollments.filter((e) => e.status !== "refunded");
  const completed = db.enrollments.filter((e) => e.status === "completed");
  const cutoff = Date.now() - 7 * 86400000;
  return {
    totalStudents: students.length,
    totalCourses: db.courses.filter((c) => c.status === "published").length,
    totalRevenue: paid.reduce((a, o) => a + o.total, 0),
    totalEnrollments: activeEnrollments.length,
    activeStudents: students.filter((u) => u.lastActiveAt && new Date(u.lastActiveAt).getTime() > cutoff).length,
    completionRate: activeEnrollments.length ? Math.round((completed.length / activeEnrollments.length) * 100) : 0,
    certificatesIssued: db.certificates.filter((c) => c.status === "valid").length,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthlyRevenue(db, months = 6) {
  const now = new Date();
  const points = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const inMonth = (iso) => {
      const x = new Date(iso);
      return x.getFullYear() === y && x.getMonth() === m;
    };
    const revenue = db.orders.filter((o) => o.status === "successful" && o.paidAt && inMonth(o.paidAt)).reduce((a, o) => a + o.total, 0);
    const enrollments = db.enrollments.filter((e) => inMonth(e.enrolledAt)).length;
    points.push({ label: `${MONTHS[m]} ${String(y).slice(2)}`, value: revenue, secondary: enrollments });
  }
  return points;
}

export function enrollmentsByCategory(db) {
  return db.categories
    .map((cat) => ({
      label: cat.name,
      value: db.enrollments.filter((e) => {
        const course = db.courses.find((c) => c.id === e.courseId);
        return course?.categoryId === cat.id && e.status !== "refunded";
      }).length,
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function topCourses(db, limit = 5) {
  return db.courses
    .filter((c) => c.status === "published")
    .map((c) => ({
      course: c,
      enrollments: db.enrollments.filter((e) => e.courseId === c.id && e.status !== "refunded").length,
      revenue: db.orders.filter((o) => o.courseId === c.id && o.status === "successful").reduce((a, o) => a + o.total, 0),
      completions: db.enrollments.filter((e) => e.courseId === c.id && e.status === "completed").length,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.enrollments - a.enrollments)
    .slice(0, limit);
}

export const adminService = {
  async stats() {
    return api.get("/admin/stats");
  },
  async setUserStatus(userId, status) {
    const { user } = await api.patch(`/admin/users/${encodeURIComponent(userId)}/status`, { status });
    useDb.getState().upsertUser(user);
  },
  async updateSettings(patch) {
    const settings = await api.put("/admin/settings", patch);
    useDb.getState().updateSettings(settings);
  },
  async saveCategory(category) {
    const { category: saved } = await api.put(`/admin/categories/${encodeURIComponent(category.id)}`, category);
    useDb.getState().upsertCategory(saved);
    return saved;
  },
  async deleteCategory(id) {
    await api.delete(`/admin/categories/${encodeURIComponent(id)}`);
    useDb.getState().deleteCategory(id);
  },
  async saveCoupon(coupon) {
    const { coupon: saved } = await api.put(`/admin/coupons/${encodeURIComponent(coupon.code)}`, coupon);
    useDb.setState((s) => ({ coupons: [saved, ...s.coupons.filter((c) => c.code !== saved.code)] }));
    return saved;
  },
  async deleteCoupon(code) {
    await api.delete(`/admin/coupons/${encodeURIComponent(code)}`);
    useDb.setState((s) => ({ coupons: s.coupons.filter((c) => c.code !== code) }));
  },
  async setContactStatus(id, status) {
    await api.patch(`/admin/contact-messages/${encodeURIComponent(id)}`, { status });
    useDb.setState((s) => ({ contactMessages: s.contactMessages.map((m) => (m.id === id ? { ...m, status } : m)) }));
  },
  /** Wipes the database and re-seeds the demo dataset (server must allow it). */
  async resetDemoData() {
    await api.post("/admin/reset-demo");
    await syncService.load();
  },
};

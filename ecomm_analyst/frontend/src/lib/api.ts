/**
 * Centralised Axios API client.
 * All endpoints mirror the FastAPI backend routers.
 */
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email); // OAuth2PasswordRequestForm uses "username"
    form.append("password", password);
    return api.post("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  me: () => api.get("/api/auth/me"),
  register: (email: string, username: string, password: string) =>
    api.post("/api/auth/register", { email, username, password }),
};

// ── Sales ────────────────────────────────────────────────────────────────────
export const salesApi = {
  list: (marketplace?: string, skip = 0, limit = 200) =>
    api.get("/api/sales/", { params: { marketplace, skip, limit } }),

  create: (payload: Record<string, unknown>) =>
    api.post("/api/sales/", payload),

  trends: (days = 30, marketplace?: string) =>
    api.get("/api/sales/analytics/trends", { params: { days, marketplace } }),

  topProducts: (limit = 5, marketplace?: string) =>
    api.get("/api/sales/analytics/top-products", { params: { limit, marketplace } }),

  mostReturned: (limit = 5, marketplace?: string) =>
    api.get("/api/sales/analytics/most-returned", { params: { limit, marketplace } }),

  bundledItems: (limit = 5, marketplace?: string) =>
    api.get("/api/sales/analytics/bundled-items", { params: { limit, marketplace } }),

  bundleAnalytics: (marketplace?: string) =>
    api.get("/api/sales/analytics/bundle-analytics", { params: { marketplace } }),

  associationLift: (marketplace?: string) =>
    api.get("/api/sales/analytics/association-lift", { params: { marketplace } }),

  competitorPricing: (marketplace?: string, product_id?: number) =>
    api.get("/api/sales/analytics/competitor-pricing", {
      params: { marketplace, product_id },
    }),

  priceTrends: (marketplace?: string) =>
    api.get("/api/sales/analytics/price-trends", { params: { marketplace } }),

  productPricingDetail: (productId: number) =>
    api.get(`/api/sales/analytics/product-pricing/${productId}`),

  competitorBreakdown: (marketplace?: string) =>
    api.get("/api/sales/analytics/competitor-breakdown", { params: { marketplace } }),
};

// ── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (marketplace?: string, skip = 0, limit = 100) =>
    api.get("/api/products/", { params: { marketplace, skip, limit } }),

  get: (id: number) => api.get(`/api/products/${id}`),

  create: (payload: Record<string, unknown>) =>
    api.post("/api/products/", payload),

  update: (id: number, payload: Record<string, unknown>) =>
    api.put(`/api/products/${id}`, payload),

  delete: (id: number) => api.delete(`/api/products/${id}`),
};

// ── Engagement ───────────────────────────────────────────────────────────────
export const engagementApi = {
  trends: (days = 30, marketplace?: string) =>
    api.get("/api/engagement/analytics/trends", { params: { days, marketplace } }),

  topViewed: (limit = 5, marketplace?: string) =>
    api.get("/api/engagement/analytics/top-viewed", { params: { limit, marketplace } }),

  imageViews: (limit = 5, marketplace?: string) =>
    api.get("/api/engagement/analytics/image-views", { params: { limit, marketplace } }),
};

// ── Comments ─────────────────────────────────────────────────────────────────
export const commentsApi = {
  list: (marketplace?: string, sentiment?: string, skip = 0, limit = 50) =>
    api.get("/api/comments/", { params: { marketplace, sentiment, skip, limit } }),

  sentimentSummary: (marketplace?: string) =>
    api.get("/api/comments/analytics/sentiment-summary", {
      params: { marketplace },
    }),

  topKeywords: (limit = 15, marketplace?: string) =>
    api.get("/api/comments/analytics/top-keywords", { params: { limit, marketplace } }),

  byProduct: (marketplace?: string) =>
    api.get("/api/comments/analytics/by-product", { params: { marketplace } }),
};

// ── Dashboard (summary) ───────────────────────────────────────────────────────
export const dashboardApi = {
  summary: (marketplace?: string) =>
    api.get("/api/dashboard/summary", { params: { marketplace } }),

  geoBreakdown: (marketplace?: string) =>
    api.get("/api/dashboard/geo-breakdown", { params: { marketplace } }),

  chartsOverview: (marketplace?: string) =>
    api.get("/api/dashboard/charts/overview", { params: { marketplace } }),

  salesByCountry: (marketplace?: string) =>
    api.get("/api/dashboard/sales-by-country", { params: { marketplace } }),

  kpiDetail: (kpiType: string, marketplace?: string) =>
    api.get(`/api/dashboard/kpi-detail/${kpiType}`, { params: { marketplace } }),
};

// ── AI Insights ───────────────────────────────────────────────────────────────
export const insightsApi = {
  ask: (segments: string[], question: string) =>
    api.post("/api/insights/ask", { segments, question }),

  history: (limit = 20) =>
    api.get("/api/insights/history", { params: { limit } }),
};

export default api;

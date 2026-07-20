import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => config);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const hadSession = Boolean(localStorage.getItem("projecthub-session"));
      localStorage.removeItem("projecthub-session");
      const requestUrl = String(error.config?.url || "");
      const isBootstrapMe = String(error.config?.method || "get").toLowerCase() === "get"
        && requestUrl.includes("/auth/me");
      if (hadSession && !isBootstrapMe) {
        window.dispatchEvent(new Event("projecthub:session-expired"));
      }
    }
    const message = error.response?.data?.message || error.message || "ไม่สามารถเชื่อมต่อระบบได้";
    const apiError = new Error(message);
    apiError.status = error.response?.status;
    apiError.code = error.response?.data?.code;
    return Promise.reject(apiError);
  },
);

/** Normalize paginated `{ items, total }` or legacy array responses. */
export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export function unwrapPage(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, limit: data.length, hasMore: false };
  }
  return {
    ...(data || {}),
    items: data?.items || [],
    total: Number(data?.total || 0),
    page: Number(data?.page || 1),
    limit: Number(data?.limit || 0),
    hasMore: Boolean(data?.hasMore),
  };
}

export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  me: () => api.get("/auth/me"),
  companies: () => api.get("/companies/public"),
  register: (payload) => api.post("/auth/register", payload),
  verifyEmail: (token) => api.post("/auth/verify-email", { token }),
  resendVerification: (email) => api.post("/auth/resend-verification", { email }),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token, password) => api.post("/auth/reset-password", { token, password }),
  switchCompany: (companyId) => api.post("/auth/switch-company", { companyId }),
  logout: () => api.post("/auth/logout"),
};

let dashboardRequest = null;
let dashboardRequestGeneration = 0;

export const dashboardApi = {
  // The shell and dashboard page mount together after a hard refresh. Share the
  // same in-flight request so the expensive dashboard aggregate is not queried twice.
  get: () => {
    if (!dashboardRequest) {
      const generation = dashboardRequestGeneration;
      dashboardRequest = api.get("/dashboard").finally(() => {
        if (dashboardRequestGeneration === generation) {
          dashboardRequest = null;
        }
      });
    }
    return dashboardRequest;
  },
  // Drop any in-flight shared response after company switch so the next get()
  // cannot reuse data from the previous tenant.
  invalidate: () => {
    dashboardRequestGeneration += 1;
    dashboardRequest = null;
  },
};

export const boardApi = {
  overview: (params) => api.get("/board-overview", { params }).then(unwrapPage),
};

export const projectsApi = {
  picker: () => api.get("/projects/picker"),
  list: (params) => api.get("/projects", { params }).then(unwrapPage),
  get: (id) => api.get(`/projects/${id}`),
  create: (payload) => api.post("/projects", payload),
  update: (id, payload) => api.patch(`/projects/${id}`, payload),
  updateStatus: (id, status) => api.patch(`/projects/${id}/status`, { status }),
  updateMembers: (id, payload) => api.put(`/projects/${id}/members`, payload),
  listWeeklyPlans: (id) => api.get(`/projects/${id}/weekly-plans`),
  createWeeklyPlan: (id, payload) => api.post(`/projects/${id}/weekly-plans`, payload),
  updateWeeklyPlan: (id, planId, payload) => api.patch(`/projects/${id}/weekly-plans/${planId}`, payload),
  listMessages: (id, params) => api.get(`/projects/${id}/messages`, { params }).then(unwrapPage),
  sendMessage: (id, body, files = [], replyToId = null) => {
    if (!files.length) return api.post(`/projects/${id}/messages`, { body, replyToId });
    const payload = new FormData();
    if (body?.trim()) payload.append("body", body.trim());
    if (replyToId) payload.append("replyToId", String(replyToId));
    files.forEach((file) => payload.append("files", file));
    return api.post(`/projects/${id}/messages`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadAttachment: (projectId, messageId, attachmentId) =>
    api.get(
      `/projects/${projectId}/messages/${messageId}/attachments/${attachmentId}/download`,
      { responseType: "blob" },
    ),
  loadInlineAttachment: (projectId, messageId, attachmentId) =>
    api.get(
      `/projects/${projectId}/messages/${messageId}/attachments/${attachmentId}/inline`,
      { responseType: "blob" },
    ),
};

export const issuesApi = {
  list: (params) => api.get("/issues", { params }).then(unwrapPage),
  get: (id) => api.get(`/issues/${id}`),
  create: (payload) => api.post("/issues", payload),
  update: (id, payload) => api.patch(`/issues/${id}`, payload),
  cancel: (id) => api.post(`/issues/${id}/cancel`),
  reject: (id, reason) => api.post(`/issues/${id}/reject`, { reason }),
  accept: (id) => api.post(`/issues/${id}/accept`),
  assign: (id, payload) => api.post(`/issues/${id}/assign`, payload),
  updateMembers: (id, memberIds) => api.put(`/issues/${id}/members`, { memberIds }),
  updateWorkflow: (id, status) => api.post(`/issues/${id}/workflow`, { status }),
  updateBoardStatus: (id, boardStatus) => api.post(`/issues/${id}/board-status`, { boardStatus }),
  convertToProject: (id, payload) => api.post(`/issues/${id}/convert-to-project`, payload),
  comments: (id, params) => api.get(`/issues/${id}/comments`, { params }).then(unwrapPage),
  addComment: (id, body, files = [], replyToId = null) => {
    if (!files.length) return api.post(`/issues/${id}/comments`, { body, replyToId });
    const payload = new FormData();
    if (body?.trim()) payload.append("body", body.trim());
    if (replyToId) payload.append("replyToId", String(replyToId));
    files.forEach((file) => payload.append("files", file));
    return api.post(`/issues/${id}/comments`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  attachments: (id) => api.get(`/issues/${id}/attachments`),
  uploadAttachments: (id, files) => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    return api.post(`/issues/${id}/attachments`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadAttachment: (issueId, attachmentId) =>
    api.get(`/issues/${issueId}/attachments/${attachmentId}/download`, {
      responseType: "blob",
    }),
  loadInlineAttachment: (issueId, attachmentId) =>
    api.get(`/issues/${issueId}/attachments/${attachmentId}/inline`, {
      responseType: "blob",
    }),
  deleteAttachment: (issueId, attachmentId) =>
    api.delete(`/issues/${issueId}/attachments/${attachmentId}`),
};

export const tasksApi = {
  list: (params) => api.get("/tasks", { params }).then(unwrapPage),
  /**
   * Fetch board/detail tasks per status column so large projects stay bounded.
   * When `status` is set, only that column is requested.
   */
  listByColumns: async (params = {}) => {
    const { status, limit = 100, ...rest } = params;
    const columns = status
      ? [status]
      : ["todo", "doing", "review", "done"];
    const pages = await Promise.all(
      columns.map((columnStatus) =>
        api.get("/tasks", {
          params: { ...rest, status: columnStatus, limit },
        }).then(unwrapPage)),
    );
    return {
      items: pages.flatMap((page) => page.items),
      totals: Object.fromEntries(
        columns.map((columnStatus, index) => [columnStatus, pages[index].total]),
      ),
      columnLimit: limit,
    };
  },
  create: (payload) => api.post("/tasks", payload),
  update: (id, payload) => api.patch(`/tasks/${id}`, payload),
};

export const usersApi = {
  list: (params) => api.get("/users", { params }),
};

export const notificationsApi = {
  list: (params) => api.get("/notifications", { params }).then(unwrapPage),
  markOneRead: (id) => api.patch(`/notifications/${id}/read`),
  markRead: () => api.patch("/notifications/read"),
};

export const accessAdminApi = {
  members: (params) => api.get("/company/members", { params }).then(unwrapPage),
  updateMemberStatus: (membershipId, status) =>
    api.patch(`/company/members/${membershipId}/status`, {
      status: status === "approved" ? "active" : status,
    }),
  updateMemberRoles: (membershipId, roles) =>
    api.put(`/company/members/${membershipId}/roles`, { roles }),
  roles: () => api.get("/company/roles"),
  permissions: () => api.get("/company/permissions"),
  auditLogs: (params) => api.get("/company/audit-logs", { params }).then(unwrapPage),
  createRole: (payload) => api.post("/company/roles", payload),
  updateRolePermissions: (roleId, permissionIds) =>
    api.put(`/company/roles/${roleId}/permissions`, { permissionIds }),
  invitations: () => api.get("/company/invitations"),
  invite: (payload) => api.post("/company/invitations", payload),
  resendInvitation: (id) => api.post(`/company/invitations/${id}/resend`),
  revokeInvitation: (id) => api.post(`/company/invitations/${id}/revoke`),
};

export const invitationsApi = {
  preview: (token) => api.get("/invitations/preview", { params: { token } }),
  accept: (token) => api.post("/invitations/accept", { token }),
};

export default api;

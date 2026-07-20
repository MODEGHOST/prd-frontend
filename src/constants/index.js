/** Product version (SemVer). Source of truth: frontend/package.json → injected at build time. */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";

export const STATUS_LABELS = {
  pending: "รออนุมัติ",
  active: "กำลังดำเนินการ",
  on_hold: "พักโครงการ",
  completed: "เสร็จสิ้น",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิกแล้ว",
  open: "รอรับเรื่อง",
  accepted: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  resolved: "เสร็จสิ้น",
  closed: "เสร็จสิ้น",
  todo: "สิ่งที่ต้องทำ",
  doing: "กำลังทำ",
  review: "ตรวจสอบ",
  done: "เสร็จแล้ว",
  planned: "วางแผน",
};

export const ROLE_LABELS = {
  admin: "ผู้ดูแลระบบ",
  member: "สมาชิก",
  requester: "ผู้แจ้ง",
  group_admin: "ผู้ดูแลกลุ่มบริษัท",
  company_owner: "ผู้ดูแลกลุ่มบริษัท (Legacy)",
  company_admin: "ผู้ดูแลบริษัท",
  project_manager: "ผู้จัดการโครงการ",
  dev: "นักพัฒนา",
  auditor: "ผู้ตรวจสอบ",
};

export const PLAN_STATUS_OPTIONS = [
  { value: "planned", label: "วางแผน" },
  { value: "in_progress", label: "กำลังทำ" },
  { value: "done", label: "เสร็จแล้ว" },
];

export const CURRENCY_OPTIONS = [
  { value: "THB", label: "THB — บาท" },
  { value: "USD", label: "USD — ดอลลาร์" },
  { value: "EUR", label: "EUR — ยูโร" },
  { value: "JPY", label: "JPY — เยน" },
  { value: "SGD", label: "SGD — ดอลลาร์สิงคโปร์" },
];

export const PRIORITY_LABELS = {
  low: "ต่ำ",
  medium: "ปานกลาง",
  high: "สูง",
  urgent: "เร่งด่วน",
};

export const PRIORITY_COLORS = {
  low: "green",
  medium: "gold",
  high: "orange",
  urgent: "red",
};

export const DIFFICULTY_LABELS = {
  easy: "ง่าย",
  medium: "ปานกลาง",
  hard: "ยาก",
};

export const DIFFICULTY_COLORS = {
  easy: "green",
  medium: "gold",
  hard: "red",
};

export const STATUS_COLORS = {
  planned: "default",
  pending: "default",
  open: "default",
  accepted: "blue",
  todo: "default",
  active: "processing",
  in_progress: "processing",
  doing: "processing",
  review: "purple",
  resolved: "purple",
  completed: "success",
  closed: "success",
  done: "success",
  rejected: "error",
  cancelled: "default",
  on_hold: "warning",
};

export const TASK_COLUMNS = ["todo", "doing", "review", "done"];

export const NAV_ITEMS = [
  { path: "/", label: "ภาพรวม", key: "dashboard" },
  { path: "/projects", label: "โครงการ", key: "projects" },
  { path: "/board", label: "กระดานงาน", key: "board" },
  { path: "/issues", label: "แจ้งปัญหา", key: "issues" },
  { path: "/my-tasks", label: "งานของฉัน", key: "my-tasks" },
];

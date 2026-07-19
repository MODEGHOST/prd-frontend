import { Spin } from "antd";

export function AppLoadingState({
  label = "กำลังโหลดข้อมูล กรุณารอสักครู่",
  fullScreen = false,
}) {
  return (
    <div
      className={`flex items-center justify-center bg-slate-50/90 ${
        fullScreen ? "min-h-screen" : "min-h-72 rounded-2xl"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-sm">
        <Spin size="large" />
        <div className="text-sm font-medium text-slate-600">{label}</div>
        <div className="text-xs text-slate-400">ระบบยังทำงานอยู่ ไม่ต้องกดรีเฟรชซ้ำ</div>
      </div>
    </div>
  );
}

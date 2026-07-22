import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Menu,
  Select,
} from "antd";
import {
  BugOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  FolderOutlined,
  LogoutOutlined,
  MenuOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { APP_VERSION, NAV_ITEMS, ROLE_LABELS } from "../constants";
import { NotificationCenter } from "../components/notifications/NotificationCenter";
import { hasPermission, isRequesterPersona } from "../utils/access";

const iconMap = {
  dashboard: <DashboardOutlined />,
  projects: <FolderOutlined />,
  board: <ProjectOutlined />,
  issues: <BugOutlined />,
  "my-tasks": <CheckSquareOutlined />,
  access: <SafetyCertificateOutlined />,
};

/** Fixed sidebar only on large desktops; iPad/tablet keep the slide-out drawer like iPhone. */
const DESKTOP_SIDEBAR_MIN_WIDTH = 1536;

function SidebarContent({ session, selectedKey, menuItems, onLogout, showBrandText = true }) {
  return (
    <div className="app-sidebar flex h-full flex-col bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white p-0.5 shadow-sm">
          <img
            src="/lee-fibreboard-logo.png"
            alt="Lee Fibreboard"
            className="h-full w-full object-contain"
          />
        </div>
        {showBrandText ? (
          <div className="min-w-0">
            <div className="text-[13px] leading-4 font-semibold text-white">
              Internal Project &amp;
              <br />
              Management System
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] tracking-[0.08em] text-red-300">
              <span>LEE FIBREBOARD</span>
              <span className="tracking-normal text-slate-500">v{APP_VERSION}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          เมนูหลัก
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          className="border-none !bg-transparent"
          style={{ borderInlineEnd: "none" }}
        />
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="bg-red-100 text-red-700">{session.user.name.slice(0, 1)}</Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-100">{session.user.name}</div>
            <div className="text-xs text-slate-400">
              {(session.user.roles || [])
                .map((role) => ROLE_LABELS[role] || role)
                .join(", ")
                || ROLE_LABELS[session.user.role]
                || session.user.role}
            </div>
          </div>
          <Button
            type="text"
            className="!text-slate-400 hover:!bg-white/10 hover:!text-white"
            icon={<LogoutOutlined />}
            onClick={onLogout}
            title="ออกจากระบบ"
          />
        </div>
      </div>
    </div>
  );
}

export function AppLayout({
  session,
  onLogout,
  children,
  notifications,
  unreadNotifications,
  markRead,
  markOneRead,
  openChat,
  pendingIssueCount = 0,
  onSwitchCompany,
  switchingCompany,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_SIDEBAR_MIN_WIDTH : true,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const requesterView = isRequesterPersona(session.user);
  const canAccessAdmin = session.user.role === "admin"
    || hasPermission(session.user, "members.read")
    || hasPermission(session.user, "roles.manage")
    || hasPermission(session.user, "audit.read");
  const canNavigate = {
    dashboard: true,
    projects: hasPermission(session.user, "projects.read_all")
      || hasPermission(session.user, "projects.create")
      || hasPermission(session.user, "projects.update"),
    board: hasPermission(session.user, "tasks.update")
      || hasPermission(session.user, "issues.transition"),
    issues: hasPermission(session.user, "issues.create")
      || hasPermission(session.user, "issues.read_all")
      || hasPermission(session.user, "issues.transition"),
    "my-tasks": hasPermission(session.user, "tasks.update")
      || hasPermission(session.user, "issues.transition"),
  };
  const baseNavigation = requesterView
    ? NAV_ITEMS
      .filter((item) => ["dashboard", "issues"].includes(item.key))
      .map((item) => (item.key === "issues" ? { ...item, label: "คำขอของฉัน" } : item))
    : NAV_ITEMS.filter((item) => canNavigate[item.key]);
  const navigationItems = canAccessAdmin
    ? [...baseNavigation, { path: "/admin/access", label: "สมาชิกและสิทธิ์", key: "access" }]
    : baseNavigation;
  const selectedKey = location.pathname === "/profile"
    ? "profile"
    : (navigationItems.find((item) => item.path === location.pathname)?.key || "dashboard");
  const pageTitle = location.pathname === "/profile"
    ? "ข้อมูลของฉัน"
    : (navigationItems.find((item) => item.path === location.pathname)?.label || "IPMS");

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "ดูข้อมูลของฉัน",
      onClick: () => navigate("/profile"),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "ออกจากระบบ",
      danger: true,
      onClick: () => onLogout?.(),
    },
  ];
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_SIDEBAR_MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  const menuItems = navigationItems.map((item) => ({
    key: item.key,
    icon: iconMap[item.key],
    label: item.key === "issues"
      ? (
        <span className="inline-flex items-center gap-2.5">
          <span>{item.label}</span>
          {pendingIssueCount > 0 ? (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] leading-none font-bold text-slate-950 shadow-sm ring-2 ring-amber-200/30"
              title={`${pendingIssueCount} Ticket ที่ยังไม่ได้รับเรื่อง`}
            >
              {pendingIssueCount > 99 ? "99+" : pendingIssueCount}
            </span>
          ) : null}
        </span>
      )
      : item.label,
    onClick: () => {
      navigate(item.path);
      setMobileOpen(false);
    },
  }));

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-slate-800 bg-slate-950 2xl:block">
        <SidebarContent
          session={session}
          selectedKey={selectedKey}
          menuItems={menuItems}
          onLogout={onLogout}
        />
      </aside>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        placement="left"
        size={260}
        styles={{ body: { padding: 0 } }}
        destroyOnHidden
      >
        <SidebarContent
          session={session}
          selectedKey={selectedKey}
          menuItems={menuItems}
          onLogout={onLogout}
        />
      </Drawer>

      <div className="2xl:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-[inset_0_2px_0_#b91c1c] backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            {!isDesktop ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileOpen(true)}
                aria-label="เปิดเมนู"
              />
            ) : null}
            <div>
              <div className="text-xs text-slate-400">IPMS</div>
              <div className="text-sm font-semibold text-slate-800">{pageTitle}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(session.companies || []).length > 1 ? (
              <Select
                className="min-w-36 max-w-44 sm:min-w-44"
                value={session.user.companyId}
                loading={switchingCompany}
                options={(session.companies || []).map((company) => ({
                  value: company.id,
                  label: company.name,
                }))}
                onChange={onSwitchCompany}
                aria-label="เลือกบริษัทที่กำลังใช้งาน"
              />
            ) : null}
            <NotificationCenter
              notifications={notifications}
              unreadTotal={unreadNotifications}
              onReadAll={markRead}
              onReadOne={markOneRead}
              onOpenChat={openChat}
              requesterView={requesterView}
            />
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <button
                type="button"
                className="cursor-pointer rounded-full border-0 bg-transparent p-0"
                aria-label="เมนูบัญชีผู้ใช้"
              >
                <Avatar className="bg-red-700">{session.user.name.slice(0, 1)}</Avatar>
              </button>
            </Dropdown>
          </div>
        </header>

        <main className="px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

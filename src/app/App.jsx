import { Suspense, useCallback, useEffect, useState } from "react";
import { ConfigProvider, App as AntApp, message } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import thTH from "antd/locale/th_TH";
import { useSession } from "../hooks/useSession";
import { AppLayout } from "../layouts/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { authApi, dashboardApi, notificationsApi } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import { IssueDrawerProvider, useIssueDrawer } from "../components/issues/IssueDrawerContext";
import { playNotificationSound, unlockNotificationSound } from "../utils/notificationSound";
import { AppRoutes } from "./routes";
import { AppErrorBoundary } from "../components/ui/AppErrorBoundary";
import { isRequesterPersona } from "../utils/access";
import { StartupWorkModal } from "../components/notifications/StartupWorkModal";
import { AppLoadingState } from "../components/ui/AppLoadingState";
import { lazyWithRetry } from "../utils/lazyWithRetry";

const MiniChatDock = lazyWithRetry(() =>
  import("../components/chat/MiniChatDock").then((module) => ({ default: module.MiniChatDock })));
const InviteAcceptPage = lazyWithRetry(() =>
  import("../pages/InviteAcceptPage").then((module) => ({ default: module.InviteAcceptPage })));

function AuthenticatedApp({
  session,
  setSession,
  showStartupSummary,
  onStartupSummaryShown,
}) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [workSummary, setWorkSummary] = useState(null);
  const [startupModalOpen, setStartupModalOpen] = useState(false);
  const [openChats, setOpenChats] = useState([]);
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const { openIssue, revision } = useIssueDrawer();
  const requesterView = isRequesterPersona(session.user);

  const refreshWorkSummary = useCallback(() =>
    dashboardApi.get()
      .then((result) => {
        setWorkSummary(result);
        return result;
      })
      .catch(() => null), []);

  const openChat = useCallback((item) => {
    if (!item?.entity_type || !item?.entity_id) return;
    if (requesterView && item.entity_type !== "issue") return;
    setOpenChats((current) => {
      const key = `${item.entity_type}:${item.entity_id}`;
      const withoutCurrent = current.filter(
        (chat) => `${chat.entity_type}:${chat.entity_id}` !== key,
      );
      return [...withoutCurrent, item];
    });
  }, [requesterView]);

  const closeChat = useCallback((chat) => {
    setOpenChats((current) =>
      current.filter(
        (item) =>
          `${item.entity_type}:${item.entity_id}`
          !== `${chat.entity_type}:${chat.entity_id}`,
      ),
    );
  }, []);

  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return undefined;

    let active = true;
    setWorkSummary(null);
    setStartupModalOpen(false);
    dashboardApi.get()
      .then((result) => {
        if (!active) return;
        setWorkSummary(result);
      })
      .catch(() => {
        if (!active) return;
        setWorkSummary({ actionItems: [], pendingIssueCount: 0, loadError: true });
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id, session?.user?.companyId]);

  useEffect(() => {
    if (!showStartupSummary || !workSummary) return;
    setStartupModalOpen(true);
    onStartupSummaryShown();
  }, [showStartupSummary, workSummary, onStartupSummaryShown]);

  useEffect(() => {
    if (revision > 0) refreshWorkSummary();
  }, [revision, refreshWorkSummary]);

  useEffect(() => {
    if (!session?.user) return undefined;

    let active = true;
    notificationsApi
      .list({ limit: 50 })
      .then((page) => {
        if (active) {
          setNotifications(page.items);
          setUnreadNotifications(page.unreadTotal || 0);
        }
      })
      .catch(() => {});

    const socket = connectSocket();

    const onNotification = (item) => {
      if (item.actor_id != null && Number(item.actor_id) === Number(session.user.id)) {
        return;
      }
      const notification = { ...item, is_read: 0 };
      setNotifications((current) => [
        notification,
        ...current.filter((entry) => Number(entry.id) !== Number(notification.id)),
      ].slice(0, 100));
      setUnreadNotifications((current) => current + 1);
      playNotificationSound();
      if (notification.type === "chat") openChat(notification);
      if (notification.entity_type === "issue") refreshWorkSummary();
    };

    socket.on("notification", onNotification);

    return () => {
      active = false;
      socket.off("notification", onNotification);
    };
  }, [session?.user?.id, session?.user?.companyId, requesterView, openChat, refreshWorkSummary]);

  const markRead = async () => {
    try {
      await notificationsApi.markRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: 1 })));
      setUnreadNotifications(0);
    } catch {
      // ignore
    }
  };

  const markOneRead = async (id) => {
    const wasUnread = notifications.some((item) =>
      Number(item.id) === Number(id) && !item.is_read);
    setNotifications((current) =>
      current.map((item) => (Number(item.id) === Number(id) ? { ...item, is_read: 1 } : item)),
    );
    if (wasUnread) setUnreadNotifications((current) => Math.max(0, current - 1));
    try {
      await notificationsApi.markOneRead(id);
    } catch {
      setNotifications((current) =>
        current.map((item) => (Number(item.id) === Number(id) ? { ...item, is_read: 0 } : item)),
      );
      if (wasUnread) setUnreadNotifications((current) => current + 1);
    }
  };

  const switchCompany = async (companyId) => {
    if (Number(companyId) === Number(session.user.companyId)) return;
    setSwitchingCompany(true);
    try {
      const nextSession = await authApi.switchCompany(companyId);
      disconnectSocket();
      dashboardApi.invalidate();
      setOpenChats([]);
      setNotifications([]);
      setUnreadNotifications(0);
      setWorkSummary(null);
      setStartupModalOpen(false);
      setSession({
        user: nextSession.user,
        companies: session.companies,
      });
      // Leave tenant-specific deep links (project detail, issue URL) and remount pages.
      navigate("/", { replace: true });
      message.success(`เปลี่ยนเป็น ${nextSession.user?.companyName || "บริษัทที่เลือก"} แล้ว`);
    } catch (error) {
      message.error(error.message);
    } finally {
      setSwitchingCompany(false);
    }
  };

  const openStartupAction = (item) => {
    setStartupModalOpen(false);
    if (item.item_type === "issue") {
      openIssue({ id: item.id }, { goToIssues: true });
      return;
    }
    navigate("/my-tasks");
  };

  const openStartupNotification = async (item) => {
    setStartupModalOpen(false);
    if (!item.is_read) await markOneRead(item.id);
    if (item.type === "chat" && item.entity_type && item.entity_id) {
      openChat(item);
      return;
    }
    if (item.entity_type === "issue" && item.entity_id) {
      openIssue({ id: item.entity_id }, { goToIssues: true });
      return;
    }
    navigate(item.target_url || (item.entity_type === "project" ? "/projects" : "/"));
  };

  return (
    <>
      <AppLayout
        session={session}
        onLogout={() => {
          const finish = () => {
            disconnectSocket();
            setOpenChats([]);
            setNotifications([]);
            setUnreadNotifications(0);
            setWorkSummary(null);
            setStartupModalOpen(false);
            setSession(null);
          };
          authApi.logout().catch(() => {}).finally(finish);
        }}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
        markRead={markRead}
        markOneRead={markOneRead}
        openChat={openChat}
        pendingIssueCount={workSummary?.pendingIssueCount || 0}
        onSwitchCompany={switchCompany}
        switchingCompany={switchingCompany}
      >
        <AppRoutes
          key={session.user.companyId}
          session={session}
          onSessionUpdate={(next) => setSession({
            user: next.user,
            companies: next.companies || session.companies,
          })}
        />
      </AppLayout>
      <StartupWorkModal
        open={startupModalOpen}
        summary={workSummary}
        notifications={notifications}
        unreadTotal={unreadNotifications}
        requesterView={requesterView}
        onClose={() => setStartupModalOpen(false)}
        onOpenAction={openStartupAction}
        onOpenNotification={openStartupNotification}
      />
      <Suspense fallback={null}>
        <MiniChatDock
          chats={openChats}
          session={session}
          onClose={closeChat}
          onExpandFull={(chat) => {
            closeChat(chat);
            if (chat.entity_type === "issue") {
              openIssue({ id: chat.entity_id }, { goToIssues: true });
            }
          }}
        />
      </Suspense>
    </>
  );
}

export default function App() {
  const location = useLocation();
  const [session, setSession] = useSession();
  const [restoring, setRestoring] = useState(true);
  const [loginSummaryRequested, setLoginSummaryRequested] = useState(false);

  // After a healthy boot, allow one future silent chunk-reload again.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.removeItem("projecthub:chunk-reload");
      } catch {
        // Ignore storage errors.
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const completeLogin = useCallback((nextSession) => {
    setLoginSummaryRequested(true);
    setSession({
      user: nextSession.user,
      companies: nextSession.companies || [],
    });
  }, [setSession]);

  const consumeLoginSummaryRequest = useCallback(() => {
    setLoginSummaryRequested(false);
  }, []);

  useEffect(() => {
    const expireSession = () => {
      disconnectSocket();
      setLoginSummaryRequested(false);
      setSession(null);
      message.warning("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    };
    window.addEventListener("projecthub:session-expired", expireSession);
    return () => window.removeEventListener("projecthub:session-expired", expireSession);
  }, [setSession]);

  useEffect(() => {
    let active = true;
    authApi.me()
      .then((data) => {
        if (!active) return;
        setSession({ user: data.user, companies: data.companies || [] });
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [setSession]);

  return (
    <ConfigProvider
      locale={thTH}
      modal={{ centered: true }}
      theme={{
        token: {
          colorPrimary: "#b91c1c",
          colorLink: "#b91c1c",
          colorLinkHover: "#991b1b",
          colorLinkActive: "#7f1d1d",
          colorBgLayout: "#f5f6f8",
          borderRadius: 10,
          fontFamily: '"Noto Sans Thai", "Segoe UI", system-ui, sans-serif',
          controlHeight: 38,
        },
        components: {
          Layout: {
            bodyBg: "#f5f6f8",
            headerBg: "#ffffff",
          },
          Button: {
            primaryShadow: "0 4px 12px rgba(185, 28, 28, 0.18)",
          },
          Card: {
            borderRadiusLG: 14,
          },
        },
      }}
    >
      <AntApp>
        <AppErrorBoundary resetKey={location.pathname}>
          {restoring ? (
            <AppLoadingState fullScreen label="กำลังตรวจสอบผู้ใช้และเตรียมข้อมูลระบบ" />
          ) : session && window.location.pathname === "/invite" ? (
            <Suspense fallback={<AppLoadingState fullScreen label="กำลังเปิดคำเชิญ" />}>
              <InviteAcceptPage />
            </Suspense>
          ) : !session ? (
            <LoginPage onLogin={completeLogin} />
          ) : (
            <IssueDrawerProvider session={session}>
              <AuthenticatedApp
                session={session}
                setSession={setSession}
                showStartupSummary={loginSummaryRequested}
                onStartupSummaryShown={consumeLoginSummaryRequest}
              />
            </IssueDrawerProvider>
          )}
        </AppErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}

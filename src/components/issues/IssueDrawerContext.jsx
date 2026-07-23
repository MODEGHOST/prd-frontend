import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { lazyWithRetry } from "../../utils/lazyWithRetry";

const IssueDetail = lazyWithRetry(() =>
  import("../issues/IssueDetail").then((module) => ({ default: module.IssueDetail })));

const IssueDrawerContext = createContext(null);

export function IssueDrawerProvider({ session, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [issue, setIssue] = useState(null);
  const [revision, setRevision] = useState(0);
  const suppressUrlOpenRef = useRef(false);
  const previousCompanyIdRef = useRef(session?.user?.companyId);

  const clearIssueFromUrl = useCallback(() => {
    if (location.pathname !== "/issues") return;
    const params = new URLSearchParams(location.search);
    if (!params.has("issue")) return;
    params.delete("issue");
    const search = params.toString();
    navigate(
      { pathname: "/issues", search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const openIssue = useCallback((target, options = {}) => {
    if (!target) return;
    const next = typeof target === "object" ? target : { id: Number(target) };
    const id = Number(next?.id);
    if (!Number.isInteger(id) || id <= 0) return;

    suppressUrlOpenRef.current = false;

    if (options.goToIssues) {
      // เปิดจาก Mini Chat: ตั้งค่าครั้งเดียว แล้วพาไปหน้า issues
      setIssue((current) => (Number(current?.id) === id ? { ...current, ...next, id } : { ...next, id }));
      const alreadyThere = location.pathname === "/issues"
        && Number(new URLSearchParams(location.search).get("issue")) === id;
      if (!alreadyThere) {
        navigate(`/issues?issue=${id}`, { replace: Boolean(options.replace) });
      }
      return;
    }

    setIssue((current) => (Number(current?.id) === id ? { ...current, ...next, id } : { ...next, id }));

    if (options.syncUrl && location.pathname === "/issues") {
      const params = new URLSearchParams(location.search);
      const hadNewRequest = params.has("new");
      params.delete("new");
      if (Number(params.get("issue")) !== id || hadNewRequest) {
        params.set("issue", String(id));
        navigate({ pathname: "/issues", search: `?${params.toString()}` }, { replace: true });
      }
    }
  }, [location.pathname, location.search, navigate]);

  const closeIssue = useCallback(() => {
    // กัน URL effect เปิด drawer ซ้ำตอนปิด
    suppressUrlOpenRef.current = true;
    setIssue(null);
    clearIssueFromUrl();
    window.setTimeout(() => {
      suppressUrlOpenRef.current = false;
    }, 0);
  }, [clearIssueFromUrl]);

  // Deep-link จาก URL เท่านั้น — ไม่ใส่ issue?.id ใน deps เพื่อไม่ให้ตอนปิดแล้วเปิดกลับ
  useEffect(() => {
    if (suppressUrlOpenRef.current) return;
    if (location.pathname !== "/issues") return;
    const issueId = Number(new URLSearchParams(location.search).get("issue"));
    if (!Number.isInteger(issueId) || issueId <= 0) return;
    setIssue((current) => (Number(current?.id) === issueId ? current : { id: issueId }));
  }, [location.pathname, location.search]);

  // สลับบริษัทแล้วต้องปิด drawer / ล้าง state ของ Ticket บริษัทเดิม
  useEffect(() => {
    const companyId = session?.user?.companyId;
    const previousCompanyId = previousCompanyIdRef.current;
    previousCompanyIdRef.current = companyId;
    if (previousCompanyId == null || Number(previousCompanyId) === Number(companyId)) {
      return undefined;
    }
    suppressUrlOpenRef.current = true;
    setIssue(null);
    clearIssueFromUrl();
    const timer = window.setTimeout(() => {
      suppressUrlOpenRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session?.user?.companyId, clearIssueFromUrl]);

  const value = useMemo(
    () => ({ issue, openIssue, closeIssue, revision }),
    [issue, openIssue, closeIssue, revision],
  );

  return (
    <IssueDrawerContext.Provider value={value}>
      {children}
      {session ? (
        <Suspense fallback={null}>
          <IssueDetail
            key={`global-issue-drawer-${session.user.companyId}`}
            issue={issue}
            user={session.user}
            open={Boolean(issue?.id)}
            onClose={closeIssue}
            onChanged={async () => setRevision((current) => current + 1)}
          />
        </Suspense>
      ) : null}
    </IssueDrawerContext.Provider>
  );
}

export function useIssueDrawer() {
  const context = useContext(IssueDrawerContext);
  if (!context) {
    throw new Error("useIssueDrawer must be used within IssueDrawerProvider");
  }
  return context;
}

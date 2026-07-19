import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { hasPermission } from "../utils/access";
import { AppLoadingState } from "../components/ui/AppLoadingState";

const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProjectsPage = lazy(() =>
  import("../pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const ProjectDetailPage = lazy(() =>
  import("../pages/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage })));
const BoardPage = lazy(() =>
  import("../pages/BoardPage").then((module) => ({ default: module.BoardPage })));
const IssuesPage = lazy(() =>
  import("../pages/IssuesPage").then((module) => ({ default: module.IssuesPage })));
const MyTasksPage = lazy(() =>
  import("../pages/MyTasksPage").then((module) => ({ default: module.MyTasksPage })));
const AccessAdminPage = lazy(() =>
  import("../pages/AccessAdminPage").then((module) => ({ default: module.AccessAdminPage })));

function canAccessAdmin(session) {
  return ["admin"].includes(session.user?.role)
    || hasPermission(session.user, "members.read")
    || hasPermission(session.user, "roles.manage")
    || hasPermission(session.user, "audit.read");
}

export function AppRoutes({ session }) {
  const canViewProjects = hasPermission(session.user, "projects.read_all")
    || hasPermission(session.user, "projects.create")
    || hasPermission(session.user, "projects.update");
  const canViewBoard = hasPermission(session.user, "tasks.update")
    || hasPermission(session.user, "issues.transition");
  const canViewMyTasks = canViewBoard;
  return (
    <Suspense
      fallback={(
        <AppLoadingState label="กำลังเตรียมหน้าที่เลือก" />
      )}
    >
      <Routes>
        <Route path="/" element={<DashboardPage user={session.user} />} />
        <Route path="/projects" element={!canViewProjects
          ? <Navigate to="/issues" replace />
          : <ProjectsPage user={session.user} />} />
        <Route path="/projects/:id" element={!canViewProjects
          ? <Navigate to="/issues" replace />
          : <ProjectDetailPage session={session} />} />
        <Route path="/board" element={!canViewBoard
          ? <Navigate to="/issues" replace />
          : <BoardPage user={session.user} />} />
        <Route path="/issues" element={<IssuesPage user={session.user} />} />
        <Route path="/my-tasks" element={!canViewMyTasks
          ? <Navigate to="/issues" replace />
          : <MyTasksPage user={session.user} />} />
        <Route
          path="/admin/access"
          element={canAccessAdmin(session)
            ? <AccessAdminPage user={session.user} />
            : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

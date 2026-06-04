import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { HealthPage } from "./pages/HealthPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectFilesPage } from "./pages/ProjectFilesPage";
import { ProjectOverviewPage } from "./pages/ProjectOverviewPage";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectReportsPage } from "./pages/ProjectReportsPage";
import { ProjectsPage } from "./pages/ProjectsPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/projects/:projectName" element={<ProjectPage />}>
          <Route index element={<ProjectOverviewPage />} />
          <Route path="files" element={<ProjectFilesPage />} />
          <Route path="reports" element={<ProjectReportsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

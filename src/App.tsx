import { lazy } from "react";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import Home from "@/pages/Home";
const AboutMe = lazy(() => import("@/pages/AboutMe"));
const AdminBox = lazy(() => import("@/pages/AdminBox"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminPosts = lazy(() => import("@/pages/AdminPosts"));
const Blog = lazy(() => import("@/pages/Blog"));
const Box = lazy(() => import("@/pages/Box"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Dev = lazy(() => import("@/pages/Dev"));
const Friends = lazy(() => import("@/pages/Friends"));
const Games = lazy(() => import("@/pages/Games"));
const Lab = lazy(() => import("@/pages/Lab"));
const Links = lazy(() => import("@/pages/Links"));
const Login = lazy(() => import("@/pages/Login"));
const News = lazy(() => import("@/pages/News"));
const Notes = lazy(() => import("@/pages/Notes"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Register = lazy(() => import("@/pages/Register"));
const RSS = lazy(() => import("@/pages/RSS"));
const Rail = lazy(() => import("@/pages/Rail"));
const Status = lazy(() => import("@/pages/Status"));
const Uses = lazy(() => import("@/pages/Uses"));
const Focus = lazy(() => import("@/pages/Focus"));
const F1 = lazy(() => import("@/pages/F1"));
const Speed = lazy(() => import("@/pages/Speed"));
const Ip = lazy(() => import("@/pages/Ip"));
import { isElectronApp } from "@/lib/runtime";
import { isRailHost, RAIL_FEATURE_PATHS } from "@/lib/rail-navigation";
import { CanonicalSite } from "@/components/CanonicalSite";
import { SUBDOMAIN_ROUTES, isPortalHost } from "@/lib/site-routing";

const rootPages: Record<string, React.ComponentType> = {
  "/about-me": AboutMe, "/blog": Blog, "/box": Box, "/changelog": Changelog,
  "/dev": Dev, "/friends": Friends, "/lab": Lab, "/links": Links, "/rss": RSS,
  "/status": Status, "/games": Games, "/focus": Focus, "/news": News,
  "/cr": Rail, "/f1": F1, "/ip": Ip, "/speed": Speed, "/uses": Uses,
};

// Electron 以 file:// 加载，BrowserRouter 无法处理刷新/深链，改用 HashRouter
const Router = isElectronApp() ? HashRouter : BrowserRouter;

export default function App() {
  const host = window.location.hostname;
  const rootPath = isPortalHost(host) ? SUBDOMAIN_ROUTES[host.split(".")[0]] : undefined;
  const RootPage = rootPages[rootPath] || (host === "speed.yukino.bond" ? Speed : Home);
  return (
    <Router>
      <CanonicalSite>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<RootPage />} />
          {Object.entries(rootPages).map(([path, Page]) => <Route key={path} path={path} element={<Page />} />)}
          {isRailHost() && Object.values(RAIL_FEATURE_PATHS).map(path => <Route key={path} path={path} element={<Rail />} />)}
          <Route path="/notes" element={<Notes />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/box" element={<AdminBox />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </CanonicalSite>
    </Router>
  );
}

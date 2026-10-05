import { lazy, useEffect } from "react";
import { BrowserRouter, HashRouter, Route, Routes, useNavigate } from "react-router-dom";
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
import { isElectronApp } from "@/lib/runtime";
import { isRailHost, RAIL_FEATURE_PATHS } from "@/lib/rail-navigation";

const SUBDOMAIN_ROUTE_MAP: Record<string, string> = {
  dev: "/dev",
  blog: "/blog",
  box: "/box",
  links: "/links",
  about: "/about-me",
  uses: "/uses",
  changelog: "/changelog",
  friends: "/friends",
  rss: "/rss",
  lab: "/lab",
  status: "/status",
  games: "/games",
  focus: "/focus",
  news: "/news",
  f1: "/f1",
  www: "/",
};

function SubdomainRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 3) {
      const subdomain = parts[0];
      const targetPath = SUBDOMAIN_ROUTE_MAP[subdomain];
      if (targetPath && window.location.pathname === "/") {
        navigate({ pathname: targetPath, search: window.location.search, hash: window.location.hash }, { replace: true });
      }
    }
  }, [navigate]);

  return null;
}

// Electron 以 file:// 加载，BrowserRouter 无法处理刷新/深链，改用 HashRouter
const Router = isElectronApp() ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <SubdomainRouter />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={isRailHost() ? <Rail /> : <Home />} />
          {isRailHost() && Object.values(RAIL_FEATURE_PATHS).map(path => <Route key={path} path={path} element={<Rail />} />)}
          <Route path="/notes" element={<Notes />} />
          <Route path="/about-me" element={<AboutMe />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/box" element={<Box />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/dev" element={<Dev />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/links" element={<Links />} />
          <Route path="/rss" element={<RSS />} />
          <Route path="/status" element={<Status />} />
          <Route path="/games" element={<Games />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/news" element={<News />} />
          <Route path="/cr" element={<Rail />} />
          <Route path="/f1" element={<F1 />} />
          <Route path="/uses" element={<Uses />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/box" element={<AdminBox />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

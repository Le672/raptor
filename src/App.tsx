import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import AboutMe from "@/pages/AboutMe";
import AdminBox from "@/pages/AdminBox";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminPosts from "@/pages/AdminPosts";
import Blog from "@/pages/Blog";
import Box from "@/pages/Box";
import Changelog from "@/pages/Changelog";
import Dev from "@/pages/Dev";
import Friends from "@/pages/Friends";
import Games from "@/pages/Games";
import Home from "@/pages/Home";
import Lab from "@/pages/Lab";
import Links from "@/pages/Links";
import Login from "@/pages/Login";
import Notes from "@/pages/Notes";
import NotFound from "@/pages/NotFound";
import Register from "@/pages/Register";
import RSS from "@/pages/RSS";
import Status from "@/pages/Status";
import Uses from "@/pages/Uses";

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
        navigate(targetPath, { replace: true });
      }
    }
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <SubdomainRouter />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
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
          <Route path="/uses" element={<Uses />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/box" element={<AdminBox />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

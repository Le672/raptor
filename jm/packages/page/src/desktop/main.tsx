import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { initializeTheme } from '../theme/theme-dom';
import { ensureBackendPreconnect } from '../backend-url';
import DesktopHome from './DesktopHome';
import '../index.css';
import './desktop.css';

initializeTheme();
ensureBackendPreconnect();
const ReaderPage = lazy(() => import('../reader'));
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Suspense fallback={<div className="desktop-loading">正在打开书房…</div>}>
            <Routes>
              <Route path="/" element={<DesktopHome />} />
              <Route path="/reader/:albumId" element={<ReaderPage />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);

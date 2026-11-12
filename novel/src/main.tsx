import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './style.css';
import { SessionProvider } from './AuthControls';
import { startPwa } from './pwa';
startPwa();
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><SessionProvider><App /></SessionProvider></BrowserRouter></React.StrictMode>);

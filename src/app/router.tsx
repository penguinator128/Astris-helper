/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from 'react-router';
import { Shell } from './Shell';
import Home from '@/modules/home/Home';
import { RouteError } from './RouteError';
import { useSettings } from '@/store/settings';

function lazyModule(loader: () => Promise<{ default: React.ComponentType }>) {
  return async () => {
    const mod = await loader();
    return { Component: mod.default };
  };
}

function GateHome() {
  const done = useSettings((s) => s.onboardingDone);
  if (!done) return <Navigate to="/welcome" replace />;
  return <Home />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <GateHome /> },
      { path: 'welcome', lazy: lazyModule(() => import('@/modules/settings/Onboarding')) },
      { path: 'plan', lazy: lazyModule(() => import('@/modules/plan/Planner')) },
      { path: 'light', lazy: lazyModule(() => import('@/modules/light/LightIndex')) },
      { path: 'light/:id', lazy: lazyModule(() => import('@/modules/light/LightEditor')) },
      { path: 'frame', lazy: lazyModule(() => import('@/modules/frame/FrameIndex')) },
      { path: 'frame/:id', lazy: lazyModule(() => import('@/modules/frame/FrameEditor')) },
      { path: 'colour', lazy: lazyModule(() => import('@/modules/colour/ColourStudio')) },
      { path: 'calc', lazy: lazyModule(() => import('@/modules/calc/CalcIndex')) },
      { path: 'calc/:calcId', lazy: lazyModule(() => import('@/modules/calc/CalcPage')) },
      { path: 'shots', lazy: lazyModule(() => import('@/modules/shots/ShotList')) },
      { path: 'storyboard', lazy: lazyModule(() => import('@/modules/storyboard/Storyboard')) },
      { path: 'slate', lazy: lazyModule(() => import('@/modules/slate/Slate')) },
      { path: 'awards', lazy: lazyModule(() => import('@/modules/awards/Awards')) },
      { path: 'callsheet', lazy: lazyModule(() => import('@/modules/callsheet/CallSheet')) },
      { path: 'checklist', lazy: lazyModule(() => import('@/modules/checklist/Checklist')) },
      { path: 'export', lazy: lazyModule(() => import('@/modules/export/ExportPage')) },
      { path: 'projects', lazy: lazyModule(() => import('@/modules/projects/ProjectsPage')) },
      { path: 'settings', lazy: lazyModule(() => import('@/modules/settings/SettingsPage')) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

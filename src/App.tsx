import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WorkoutPage } from './components/workouts/WorkoutPage';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useTheme } from './hooks/useTheme';

// Route-level code splitting: charts and the settings/sync surface used to ship in the
// initial bundle even though most sessions only log workouts. WorkoutPage stays eager —
// it is the landing screen.
const HistoryList = lazy(() => import('./components/history/HistoryList').then(m => ({ default: m.HistoryList })));
const ExerciseList = lazy(() => import('./components/exercises/ExerciseList').then(m => ({ default: m.ExerciseList })));
const StatsPage = lazy(() => import('./components/stats/StatsPage').then(m => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

const RouteFallback = () => <div className="p-4 text-center mt-10 text-text-secondary">Loading...</div>;

function App() {
  useTheme();

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="h-full flex flex-col">
          <HashRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<AppShell />}>
                  <Route index element={<Navigate to="/workout" replace />} />
                  <Route path="workout" element={<WorkoutPage />} />
                  <Route path="history" element={<HistoryList />} />
                  <Route path="exercises" element={<ExerciseList />} />
                  <Route path="stats" element={<StatsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ExerciseList } from './components/exercises/ExerciseList';
import { WorkoutPage } from './components/workouts/WorkoutPage';
import { HistoryList } from './components/history/HistoryList';
import { StatsPage } from './components/stats/StatsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/common/Toast';
import { useTheme } from './hooks/useTheme';

function App() {
  useTheme();

  return (
    <ToastProvider>
      <div className="h-full flex flex-col">
        <HashRouter>
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
        </HashRouter>
      </div>
    </ToastProvider>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ExerciseList } from './components/exercises/ExerciseList';
import { WorkoutPage } from './components/workouts/WorkoutPage';
import { HistoryList } from './components/history/HistoryList';

import { StatsPage } from './components/stats/StatsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ExerciseList } from './components/exercises/ExerciseList';
import { WorkoutPage } from './components/workouts/WorkoutPage';
import { HistoryList } from './components/history/HistoryList';

// Placeholder Pages
const HistoryPage = () => <div className="p-4">History Page</div>;
// ExercisesPage replaced by ExerciseList
const StatsPage = () => <div className="p-4">Stats Page</div>;
import { SettingsPage } from './components/settings/SettingsPage';

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

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginView } from './components/LoginView';
import { AppProvider, useApp } from './context/AppContext';
import { CameraPage } from './pages/CameraPage';
import { ControlPage } from './pages/ControlPage';
import { EventsPage } from './pages/EventsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RfidPage } from './pages/RfidPage';

function AppRoutes() {
  const { session, authLoading } = useApp();

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}
      >
        Verificando sesión…
      </div>
    );
  }

  if (!session) {
    return <LoginView />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ControlPage />} />
        <Route path="/camera" element={<CameraPage />} />
        <Route path="/rfid" element={<RfidPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

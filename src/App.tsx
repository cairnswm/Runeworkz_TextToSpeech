import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AlertProvider } from './context/AlertContext';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import { Spinner } from './components/ui';
import LandingPage from './pages/LandingPage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import SpacePage from './pages/SpacePage';
import ProjectPage from './pages/ProjectPage';

function Protected() {
  const { token, profile, loading, authError } = useAuth();
  if (loading || (token && !profile)) return <Spinner label="Signing you in…" />;
  if (!token) return <Navigate to={authError ? '/login' : '/'} replace />;
  return <AppLayout />;
}

/** Pages for signed-out visitors; signed-in users go straight to Home. */
function Public({ children }: { children: JSX.Element }) {
  const { token, loading } = useAuth();
  if (loading) return <Spinner label="Signing you in…" />;
  return token ? <Navigate to="/home" replace /> : children;
}

function AppRoutes() {
  const { authError } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Public><LandingPage /></Public>} />
      <Route path="/login" element={authError ? <LoginPage /> : <Public><LoginPage /></Public>} />
      <Route path="/register" element={<Public><RegisterPage /></Public>} />
      <Route path="/forgot" element={<Public><ForgotPasswordPage /></Public>} />
      <Route path="/reset" element={<ResetPasswordPage />} />
      <Route element={<Protected />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/spaces/:spaceId" element={<SpacePage />} />
        <Route path="/spaces/:spaceId/projects/:projectId" element={<ProjectPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AlertProvider>
        <TenantProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </TenantProvider>
      </AlertProvider>
    </ThemeProvider>
  );
}

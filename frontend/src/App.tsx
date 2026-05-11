import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { Layout } from '@/components/layout/Layout';
import { Login } from '@/pages/Login';
import { Profiles } from '@/pages/Profiles';
import { Dashboard } from '@/pages/Dashboard';
import { Campaigns } from '@/pages/Campaigns';
import { Creatives } from '@/pages/Creatives';
import { Audiences } from '@/pages/Audiences';
import { Rules } from '@/pages/Rules';
import { Integrations } from '@/pages/Integrations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="profiles/new" element={<Profiles />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="creatives" element={<Creatives />} />
            <Route path="audiences" element={<Audiences />} />
            <Route path="rules" element={<Rules />} />
            <Route path="integrations" element={<Integrations />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

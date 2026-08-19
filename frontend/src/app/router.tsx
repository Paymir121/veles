import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/shared/components/Layout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { PersonDetailPage } from '@/features/persons/PersonDetailPage';
import { PersonFormPage } from '@/features/persons/PersonFormPage';
import { TreePage } from '@/features/tree/TreePage';
import { MapPage } from '@/features/map/MapPage';

// Route table only - like urls.py. Login/register sit outside Layout
// entirely. Everything else shares the NavBar/Layout shell, but only
// creating/editing a person requires being logged in -- viewing the tree,
// the map, and any single person's detail page is public (matches the
// backend: TreeView, BurialPlaceViewSet.list/retrieve, PersonViewSet.retrieve
// and SearchView are all AllowAny).
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/tree" replace />} />
        <Route path="/tree" element={<TreePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/person/:id" element={<PersonDetailPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/person/new" element={<PersonFormPage />} />
          <Route path="/person/:id/edit" element={<PersonFormPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';

export function Layout() {
  return (
    <div className="app-layout">
      <NavBar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}

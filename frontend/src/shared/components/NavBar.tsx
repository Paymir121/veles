import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';

export function NavBar() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium min-h-[44px] transition-colors ${
      isActive
        ? 'bg-accent text-accent-contrast'
        : 'text-text-muted hover:text-text hover:bg-bg-muted'
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-accent text-accent-contrast'
        : 'text-text-muted hover:text-text hover:bg-bg-muted'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-sm">
      {/* Desktop bar */}
      <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
        <Link to="/" className="font-bold text-lg text-accent-secondary shrink-0 no-underline">Велес</Link>

        {/* Burger toggle — below md */}
        <button
          type="button"
          className="btn-ghost md:hidden ml-auto"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>

        {/* Desktop links — md+ */}
        <nav className="hidden md:flex items-center gap-2 flex-1">
          <NavLink to="/" end className={linkClass}>
            Главная
          </NavLink>
          <NavLink to="/tree" className={linkClass}>
            Дерево
          </NavLink>
          <NavLink to="/map" className={linkClass}>
            Карта
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/person/new" className={linkClass}>
                Добавить человека
              </NavLink>
            </>
          )}
        </nav>

        {/* Desktop auth — md+ */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" className={linkClass}>
                {user?.username ?? 'Профиль'}
              </NavLink>
              <button type="button" className="btn-secondary text-sm" onClick={handleLogout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                Войти
              </NavLink>
              <NavLink to="/register">
                <button type="button" className="btn text-sm">Регистрация</button>
              </NavLink>
            </>
          )}
        </div>
      </div>

      {/* Mobile dropdown — below md */}
      {menuOpen && (
        <nav className="md:hidden border-t border-border bg-bg px-3 py-2 flex flex-col gap-1">
          <NavLink to="/" end className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
            Главная
          </NavLink>
          <NavLink to="/tree" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
            Дерево
          </NavLink>
          <NavLink to="/map" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
            Карта
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/person/new" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                Добавить человека
              </NavLink>
            </>
          )}
          <div className="border-t border-border mt-1 pt-2">
            {isAuthenticated ? (
              <>
              <NavLink to="/profile" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                Профиль{user ? ` (${user.username})` : ''}
              </NavLink>
              <button
                type="button"
                className="btn-ghost w-full text-left text-sm"
                onClick={() => { handleLogout(); setMenuOpen(false); }}
              >
                Выйти
              </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                  Войти
                </NavLink>
                <NavLink to="/register" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                  Регистрация
                </NavLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

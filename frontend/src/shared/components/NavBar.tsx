import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTreeUiStore } from '@/features/tree/treeUiStore';

export function NavBar() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isTreePage = location.pathname === '/tree' || location.pathname.startsWith('/tree/');
  const showPhotos = useTreeUiStore((state) => state.showPhotos);
  const isPeoplePanelOpen = useTreeUiStore((state) => state.isPeoplePanelOpen);
  const toggleShowPhotos = useTreeUiStore((state) => state.toggleShowPhotos);
  const togglePeoplePanel = useTreeUiStore((state) => state.togglePeoplePanel);

  function handleLogout() {
    logout();
    navigate('/tree', { replace: true });
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

  const mobileActionClass = (active: boolean) =>
    `w-full text-left ${mobileLinkClass({ isActive: active })}`;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-sm">
        {/* Desktop bar */}
        <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
          <Link to="/" className="font-bold text-lg text-accent-secondary shrink-0 no-underline">Велес</Link>

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
            <NavLink to="/download" className={linkClass}>
              Скачать
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
      </header>

      {/* Outside the header: backdrop-filter on header would pin position:fixed to the 56px bar. */}
      <button
        type="button"
        className="mobile-menu-fab md:hidden"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={menuOpen}
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
      {menuOpen && (
        <>
          <button
            type="button"
            className="mobile-menu-backdrop md:hidden"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="mobile-menu-panel md:hidden border border-border bg-bg px-3 py-2 flex flex-col gap-1">
            <NavLink to="/" end className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              Главная
            </NavLink>
            <NavLink to="/tree" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              Дерево
            </NavLink>
            <NavLink to="/map" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              Карта
            </NavLink>
            <NavLink to="/download" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              Скачать
            </NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/person/new" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                  Добавить человека
                </NavLink>
              </>
            )}
            {isTreePage && (
              <div className="border-t border-border mt-1 pt-2">
                <button
                  type="button"
                  className={mobileActionClass(isPeoplePanelOpen)}
                  aria-pressed={isPeoplePanelOpen}
                  onClick={() => {
                    togglePeoplePanel();
                    setMenuOpen(false);
                  }}
                >
                  {isPeoplePanelOpen ? 'Скрыть людей' : 'Люди'}
                </button>
                <button
                  type="button"
                  className={mobileActionClass(showPhotos)}
                  aria-pressed={showPhotos}
                  onClick={() => {
                    toggleShowPhotos();
                    setMenuOpen(false);
                  }}
                >
                  {showPhotos ? 'Скрыть фото' : 'Показать фото'}
                </button>
              </div>
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
        </>
      )}
    </>
  );
}

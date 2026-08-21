import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';

export function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <section className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-text mb-4 tracking-tight">
          <span className="text-accent-secondary">Велес</span>
        </h1>
        <p className="text-xl text-text-muted max-w-2xl mx-auto leading-relaxed">
          Семейный генеалогический трекер: интерактивное дерево и карта захоронений
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-text mb-3">О проекте</h2>
        <p className="text-text-muted leading-relaxed">
          Велес хранит родственников, связи и места захоронений в одном месте.
          Дерево, карту и профили можно смотреть без регистрации; добавлять
          и править записи — только после входа.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-text mb-4">Как пользоваться</h2>
        <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
          <li>
            Откройте{' '}
            <Link to="/tree" className="text-accent-secondary underline underline-offset-2">
              семейное дерево
            </Link>{' '}
            или{' '}
            <Link to="/map" className="text-accent-secondary underline underline-offset-2">
              карту захоронений
            </Link>
            {' '}— смотреть можно без входа
          </li>
          <li>
            Чтобы добавить человека, войдите и нажмите{' '}
            <strong className="text-text">Добавить человека</strong>
            {' '}в меню (или кнопку в пустом дереве)
          </li>
          <li>
            Заполните фамилию и имя. Родителей, супруга и детей можно выбрать
            из уже записанных или создать прямо в форме
          </li>
        </ol>
      </section>

      <section className="text-center py-8 px-6 bg-bg-muted rounded-2xl">
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/tree" className="btn">
            Открыть дерево
          </Link>
          <Link to="/map" className="btn-secondary">
            Открыть карту
          </Link>
          {!isAuthenticated && (
            <Link to="/register" className="btn-secondary">
              Регистрация
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

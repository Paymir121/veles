import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';

export function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
      {/* Hero */}
      <section className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold text-text mb-4 tracking-tight">
          <span className="text-accent-secondary">Велес</span>
        </h1>
        <p className="text-xl sm:text-2xl text-text-muted max-w-2xl mx-auto leading-relaxed">
          Семейный генеалогический трекер с интерактивным деревом
          и&nbsp;картой захоронений
        </p>
      </section>

      {/* What is it */}
      <section className="mb-14">
        <h2 className="text-2xl font-semibold text-text mb-4">Что это такое</h2>
        <p className="text-text-muted leading-relaxed mb-3">
          <strong className="text-text">Велес</strong> — веб-приложение для ведения
          семейной генеалогии. Оно позволяет хранить данные о родственниках, их связях,
          датах жизни и местах захоронений в едином пространстве, доступном с любого
          устройства.
        </p>
        <p className="text-text-muted leading-relaxed">
          Проект назван в честь славянского бога Велеса — покровителя мудрости, памяти
          предков и связи между поколениями.
        </p>
      </section>

      {/* Features */}
      <section className="mb-14">
        <h2 className="text-2xl font-semibold text-text mb-6">Возможности</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <FeatureCard
            icon="🌳"
            title="Интерактивное дерево"
            description="Визуальное семейное дерево с навигацией по поколениям. Родители, дети, супруги — все связи наглядно отображены на графе."
          />
          <FeatureCard
            icon="🗺️"
            title="Карта захоронений"
            description="Места захоронений отмечены на Яндекс.Картах. Можно быстро найти нужное кладбище и увидеть, кто там похоронен."
          />
          <FeatureCard
            icon="🔍"
            title="Умный поиск"
            description="Поиск по имени, фамилии, девичьей фамилии, году рождения или смерти. Находит и людей, и места захоронений."
          />
          <FeatureCard
            icon="👤"
            title="Подробные профили"
            description="Для каждого человека — даты жизни, фотография, место захоронения, фото могилы, заметки и связи с другими членами семьи."
          />
          <FeatureCard
            icon="📤"
            title="Экспорт и импорт"
            description="Данные можно выгрузить в JSON-файл для резервного копирования и загрузить обратно — ничего не потеряется."
          />
          <FeatureCard
            icon="🌐"
            title="Открытый просмотр"
            description="Дерево и карта доступны без регистрации — любой член семьи может посмотреть. Редактирование — только для авторизованных."
          />
        </div>
      </section>

      {/* Quick guide */}
      {isAuthenticated && (
        <section className="mb-14">
          <h2 className="text-2xl font-semibold text-text mb-4">Как добавить человека</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>
              Откройте{' '}
              <Link to="/tree" className="text-accent-secondary underline underline-offset-2">
                семейное дерево
              </Link>
            </li>
            <li>Нажмите на любого существующего человека — откроется его карточка</li>
            <li>
              В карточке нажмите одну из кнопок связи: <strong className="text-text">+ Отец</strong>,{' '}
              <strong className="text-text">+ Мать</strong>,{' '}
              <strong className="text-text">+ Супруг(а)</strong> или{' '}
              <strong className="text-text">+ Ребёнок</strong>
            </li>
            <li>Заполните имя, фамилию и (по желанию) даты жизни, фото и заметки</li>
            <li>Нажмите <strong className="text-text">Сохранить</strong> — новый человек появится на дереве</li>
          </ol>
          <p className="text-sm text-text-muted mt-3">
            Если дерево пустое — нажмите кнопку <strong className="text-text">Добавить первого человека</strong> на странице дерева.
          </p>
        </section>
      )}

      {/* Why */}
      <section className="mb-14">
        <h2 className="text-2xl font-semibold text-text mb-4">Зачем это нужно</h2>
        <div className="space-y-3 text-text-muted leading-relaxed">
          <p>
            Семейная история хранится в головах старших родственников, на обрывках бумаг
            и в разрозненных сообщениях. Со временем эти данные теряются — люди забывают
            имена, путают даты, а записки исчезают.
          </p>
          <p>
            <strong className="text-text">Велес</strong> собирает всё в одном месте:
            кто кому кем приходится, когда родился и умер, где похоронен. Это не просто
            база данных — это живое дерево с визуальной навигацией, которое удобно
            пополнять и показывать родным.
          </p>
          <p>
            Карта захоронений решает отдельную практическую задачу: когда нужно навестить
            могилу дальнего родственника, не приходится вспоминать, на каком кладбище
            и в каком ряду искать — всё отмечено на карте с координатами.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-10 px-6 bg-bg-muted rounded-2xl">
        <h2 className="text-xl font-semibold text-text mb-3">Начните исследовать</h2>
        <p className="text-text-muted mb-6">
          Посмотрите семейное дерево или откройте карту захоронений
        </p>
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

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-5 rounded-xl bg-surface border border-border">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}

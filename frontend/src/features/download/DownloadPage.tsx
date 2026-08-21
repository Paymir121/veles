import { EXE_DOWNLOAD_URL, REPO_URL } from './links';

export function DownloadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <section className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-text mb-3 tracking-tight">Скачать</h1>
        <p className="text-text-muted leading-relaxed">
          Исходный код открыт. Сборка Windows-приложения пока дорабатывается —
          готовый .exe будет на странице релизов.
        </p>
      </section>

      <div className="grid gap-5">
        <article className="p-5 rounded-xl bg-surface border border-border">
          <h2 className="text-xl font-semibold text-text mb-2">Репозиторий</h2>
          <p className="text-text-muted leading-relaxed mb-4">
            Код проекта, история изменений и задачи — на GitHub.
          </p>
          <a
            href={REPO_URL}
            className="btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть репозиторий
          </a>
        </article>

        <article className="p-5 rounded-xl bg-surface border border-border">
          <h2 className="text-xl font-semibold text-text mb-2">Сборка для Windows</h2>
          <p className="text-text-muted leading-relaxed mb-4">
            Установщик .exe публикуется в GitHub Releases.
          </p>
          <a
            href={EXE_DOWNLOAD_URL}
            className="btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Скачать .exe
          </a>
        </article>
      </div>
    </div>
  );
}

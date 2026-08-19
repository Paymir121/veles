import type { ExtraInfoItem } from '@/shared/types';

export const EXTRA_INFO_SHORT_FIELD_MAX_LENGTH = 300;
export const EXTRA_INFO_DESCRIPTION_MAX_LENGTH = 2000;
export const EXTRA_INFO_MAX_ITEMS = 100;

interface ExtraInfoListEditorProps {
  items: ExtraInfoItem[];
  onChange: (items: ExtraInfoItem[]) => void;
}

function emptyItem(): ExtraInfoItem {
  return { category: '', title: '', role: '', date_from: '', date_to: '', description: '' };
}

export function ExtraInfoListEditor({ items, onChange }: ExtraInfoListEditorProps) {
  function updateItem(index: number, patch: Partial<ExtraInfoItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    if (items.length >= EXTRA_INFO_MAX_ITEMS) return;
    onChange([...items, emptyItem()]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Дополнительная информация</h3>
        <button
          type="button"
          className="btn-secondary btn text-sm"
          onClick={addItem}
          disabled={items.length >= EXTRA_INFO_MAX_ITEMS}
        >
          Добавить запись
        </button>
      </div>

      {items.length === 0 && <p className="text-sm text-text-muted">Записей пока нет.</p>}

      {items.map((item, index) => (
        <div className="card space-y-3" key={index} data-testid="extra-info-row">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="field-label">
              Категория
              <input
                className="input"
                aria-label={`Категория, запись ${index + 1}`}
                placeholder="Например: образование, служба, награды"
                value={item.category}
                maxLength={EXTRA_INFO_SHORT_FIELD_MAX_LENGTH}
                onChange={(e) => updateItem(index, { category: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              Заголовок
              <input
                className="input"
                aria-label={`Заголовок, запись ${index + 1}`}
                value={item.title}
                maxLength={EXTRA_INFO_SHORT_FIELD_MAX_LENGTH}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              Роль
              <input
                className="input"
                aria-label={`Роль, запись ${index + 1}`}
                value={item.role ?? ''}
                maxLength={EXTRA_INFO_SHORT_FIELD_MAX_LENGTH}
                onChange={(e) => updateItem(index, { role: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field-label">
                Дата с
                <input
                  className="input"
                  aria-label={`Дата с, запись ${index + 1}`}
                  value={item.date_from ?? ''}
                  maxLength={EXTRA_INFO_SHORT_FIELD_MAX_LENGTH}
                  onChange={(e) => updateItem(index, { date_from: e.target.value })}
                />
              </label>
              <label className="field-label">
                Дата по
                <input
                  className="input"
                  aria-label={`Дата по, запись ${index + 1}`}
                  value={item.date_to ?? ''}
                  maxLength={EXTRA_INFO_SHORT_FIELD_MAX_LENGTH}
                  onChange={(e) => updateItem(index, { date_to: e.target.value })}
                />
              </label>
            </div>
          </div>
          <label className="field-label">
            Описание
            <textarea
              className="input min-h-[80px]"
              aria-label={`Описание, запись ${index + 1}`}
              value={item.description ?? ''}
              maxLength={EXTRA_INFO_DESCRIPTION_MAX_LENGTH}
              onChange={(e) => updateItem(index, { description: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn-ghost text-error text-sm"
            onClick={() => removeItem(index)}
            aria-label={`Удалить запись ${index + 1}`}
          >
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
}

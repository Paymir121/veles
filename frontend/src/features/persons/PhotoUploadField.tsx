import { useRef } from 'react';

interface PhotoUploadFieldProps {
  label: string;
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
}

function useBlobUrl(file: File | null): string | null {
  const prev = useRef<{ file: File; url: string } | null>(null);

  if (file && prev.current?.file === file) {
    return prev.current.url;
  }

  if (prev.current) {
    URL.revokeObjectURL(prev.current.url);
    prev.current = null;
  }

  if (file) {
    const url = URL.createObjectURL(file);
    prev.current = { file, url };
    return url;
  }

  return null;
}

export function PhotoUploadField({ label, file, existingUrl, onChange }: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blobUrl = useBlobUrl(file);

  const previewSrc = blobUrl ?? existingUrl;

  return (
    <div className="space-y-3">
      <span className="field-label">{label} (необязательно)</span>

      {previewSrc && (
        <img
          src={previewSrc}
          alt={label}
          className="w-28 h-28 object-cover rounded-lg border border-border"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={() => inputRef.current?.click()}
        >
          {previewSrc ? 'Заменить фото' : 'Выбрать фото'}
        </button>
        {previewSrc && (
          <button
            type="button"
            className="btn-ghost text-sm text-error"
            onClick={() => onChange(null)}
          >
            Удалить
          </button>
        )}
      </div>

      {file && <p className="text-xs text-text-muted">Файл: {file.name}</p>}
    </div>
  );
}

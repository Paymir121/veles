interface PhotoUploadFieldProps {
  label: string;
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
}

export function PhotoUploadField({ label, file, existingUrl, onChange }: PhotoUploadFieldProps) {
  return (
    <div className="space-y-2">
      <label className="field-label">
        {label} (необязательно)
        <input
          className="input text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-accent file:font-medium file:cursor-pointer"
          type="file"
          accept="image/*"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && <p className="text-xs text-text-muted">Выбран файл: {file.name}</p>}
      {!file && existingUrl && <img src={existingUrl} alt={label} className="max-w-[160px] rounded-lg border border-border" />}
    </div>
  );
}

import { Map, Placemark, YMaps, useYMaps } from '@pbe/react-yandex-maps';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  FOCUSED_MAP_ZOOM,
  hasYandexMapsApiKey,
  yandexMapsQuery,
} from '@/shared/maps/yandexMapsSetup';
import type { Gender, PersonStatus } from '@/shared/types';

type YMapsApi = NonNullable<ReturnType<typeof useYMaps>>;

interface GeocodeResultLike {
  getAddressLine(): string;
  getLocalities(): readonly string[];
  getAdministrativeAreas(): readonly string[];
  geometry: { getCoordinates(): number[] | null } | null;
}

import { ExtraInfoListEditor } from './ExtraInfoListEditor';
import { PhotoUploadField } from './PhotoUploadField';
import {
  useBurialPlaceOption,
  useBurialPlaceSearch,
  useCreateBurialPlace,
  usePerson,
  usePersons,
} from './hooks';
import {
  EMPTY_BURIAL_PLACE_DRAFT,
  EMPTY_PERSON_FORM_VALUES,
  isBurialPlaceDraftFilled,
  type BurialPlaceDraft,
  type PersonFormValues,
} from './types';
import type { PersonSubmitFiles } from './api';

const SHORT_TEXT_MAX_LENGTH = 300;

interface PersonFormProps {
  initialValues?: PersonFormValues;
  initialPhotoUrl?: string | null;
  initialGravePhotoUrl?: string | null;
  excludePersonId?: number;
  submitLabel?: string;
  isSubmitting?: boolean;
  onSubmit: (values: PersonFormValues, files: PersonSubmitFiles) => void;
}

type WizardStep = 'basics' | 'parents' | 'burial' | 'extras';

const STEP_LABELS: Record<WizardStep, string> = {
  basics: 'Основное',
  parents: 'Родители',
  burial: 'Захоронение',
  extras: 'Фото и доп.',
};

export function PersonForm({
  initialValues,
  initialPhotoUrl,
  initialGravePhotoUrl,
  excludePersonId,
  submitLabel = 'Сохранить',
  isSubmitting = false,
  onSubmit,
}: PersonFormProps) {
  const [values, setValues] = useState<PersonFormValues>(initialValues ?? EMPTY_PERSON_FORM_VALUES);
  const [photo, setPhoto] = useState<File | null>(null);
  const [gravePhoto, setGravePhoto] = useState<File | null>(null);
  const [step, setStep] = useState<WizardStep>('basics');
  const [validationError, setValidationError] = useState('');
  // A new burial place lives here, next to the person's own fields, and is
  // created as part of saving the person - see handleSubmit.
  const [placeDraft, setPlaceDraft] = useState<BurialPlaceDraft>(EMPTY_BURIAL_PLACE_DRAFT);
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [isSavingPlace, setIsSavingPlace] = useState(false);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const createPlaceMutation = useCreateBurialPlace();

  function setField<K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const isDeceased = values.status === 'deceased';

  const steps: WizardStep[] = isDeceased
    ? ['basics', 'parents', 'burial', 'extras']
    : ['basics', 'parents', 'extras'];

  function handleStatusChange(status: PersonStatus) {
    setValues((prev) => ({
      ...prev,
      status,
      ...(status === 'alive'
        ? { death_date: '', death_date_text: '', burial_place: '', burial_plot_details: '' }
        : {}),
    }));
    if (status === 'alive') {
      setPlaceDraft(EMPTY_BURIAL_PLACE_DRAFT);
      setIsDraftOpen(false);
      if (step === 'burial') setStep('basics');
    }
  }

  const hasPlaceDraft = isDeceased && values.burial_place === '' && isBurialPlaceDraftFilled(placeDraft);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.last_name.trim() || !values.first_name.trim()) {
      setValidationError('Заполните фамилию и имя.');
      setStep('basics');
      return;
    }

    let submittedValues = values;
    if (hasPlaceDraft) {
      setIsSavingPlace(true);
      try {
        const coordinates = await resolveDraftCoordinates(placeDraft, ymapsRef.current);
        const placeName =
          placeDraft.name.trim() ||
          placeDraft.address.trim() ||
          placeDraft.city.trim() ||
          (coordinates.latitude !== '' && coordinates.longitude !== ''
            ? `${coordinates.latitude}, ${coordinates.longitude}`
            : 'Без названия');
        const created = await createPlaceMutation.mutateAsync({
          name: placeName,
          city: placeDraft.city,
          address: placeDraft.address,
          description: '',
          ...coordinates,
        });
        submittedValues = { ...values, burial_place: created.id };
        setValues(submittedValues);
        setPlaceDraft(EMPTY_BURIAL_PLACE_DRAFT);
        setIsDraftOpen(false);
      } catch {
        setValidationError('Не удалось сохранить место захоронения. Проверьте название и координаты.');
        setStep('burial');
        return;
      } finally {
        setIsSavingPlace(false);
      }
    }

    setValidationError('');
    onSubmit(submittedValues, { photo, gravePhoto });
  }

  function goNext() {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }

  function goPrev() {
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }

  const stepIndex = steps.indexOf(step);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Wizard step indicator */}
      <div className="wizard-steps">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            className="wizard-step-btn"
            data-active={s === step}
            onClick={() => setStep(s)}
          >
            <span className="wizard-step-num">{i + 1}</span>
            {STEP_LABELS[s]}
          </button>
        ))}
      </div>

      {validationError && (
        <div className="rounded-lg bg-error/10 text-error text-sm px-3 py-2">
          {validationError}
        </div>
      )}

      {/* Step: Basics */}
      {step === 'basics' && (
        <StepBasics
          values={values}
          setField={setField}
          onStatusChange={handleStatusChange}
          isDeceased={isDeceased}
        />
      )}

      {/* Step: Parents */}
      {step === 'parents' && (
        <StepParents values={values} setField={setField} excludePersonId={excludePersonId} />
      )}

      {/* Step: Burial */}
      {step === 'burial' && (
        <StepBurial
          values={values}
          setField={setField}
          gravePhoto={gravePhoto}
          initialGravePhotoUrl={initialGravePhotoUrl}
          onGravePhotoChange={setGravePhoto}
          draft={placeDraft}
          onDraftChange={setPlaceDraft}
          isDraftOpen={isDraftOpen}
          onDraftOpenChange={setIsDraftOpen}
          onYmapsReady={(instance) => {
            ymapsRef.current = instance;
          }}
        />
      )}

      {/* Step: Extras */}
      {step === 'extras' && (
        <StepExtras
          values={values}
          setField={setField}
          photo={photo}
          initialPhotoUrl={initialPhotoUrl}
          onPhotoChange={setPhoto}
        />
      )}

      {/* Bottom bar */}
      <div className="sticky bottom-0 bg-bg/90 backdrop-blur-sm border-t border-border -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 flex items-center gap-3">
        {stepIndex > 0 && (
          <button type="button" className="btn btn-secondary" onClick={goPrev}>
            Назад
          </button>
        )}
        {stepIndex < steps.length - 1 && (
          <button type="button" className="btn btn-secondary" onClick={goNext}>
            Далее
          </button>
        )}
        <button type="submit" className="btn ml-auto" disabled={isSubmitting || isSavingPlace}>
          {isSavingPlace ? 'Сохраняем место...' : isSubmitting ? 'Сохранение...' : submitLabel}
        </button>
      </div>
      {hasPlaceDraft && (
        <p className="text-xs text-text-muted -mt-3">
          Новое место «{placeDraft.name || 'без названия'}» будет создано вместе с этой записью.
        </p>
      )}
    </form>
  );
}

/** Coordinates for a place being saved: whatever was picked on the map, or a
 *  best-effort geocode of the typed address when no point was picked. If the
 *  geocoder finds nothing (or the maps SDK never loaded, e.g. no API key), the
 *  place is still created, just without coordinates. */
async function resolveDraftCoordinates(
  draft: BurialPlaceDraft,
  ymapsInstance: YMapsApi | null,
): Promise<{ latitude: number | ''; longitude: number | '' }> {
  if (draft.latitude !== '' && draft.longitude !== '') {
    return { latitude: Number(draft.latitude), longitude: Number(draft.longitude) };
  }
  const addressQuery = [draft.address, draft.city].filter((part) => part.trim()).join(', ');
  if (!ymapsInstance || !addressQuery) return { latitude: '', longitude: '' };

  try {
    const result = await ymapsInstance.geocode(addressQuery);
    const found = result.geoObjects.get(0) as unknown as GeocodeResultLike | null;
    const coords = found?.geometry?.getCoordinates();
    if (coords) {
      return {
        latitude: Number(coords[0].toFixed(6)),
        longitude: Number(coords[1].toFixed(6)),
      };
    }
  } catch {
    // Fall through: a place without coordinates is still worth saving.
  }
  return { latitude: '', longitude: '' };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Step sub-components (internal to this file)
   ═══════════════════════════════════════════════════════════════════════════ */

interface StepProps {
  values: PersonFormValues;
  setField: <K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) => void;
}

function StepBasics({
  values,
  setField,
  onStatusChange,
  isDeceased,
}: StepProps & { onStatusChange: (s: PersonStatus) => void; isDeceased: boolean }) {
  const [showMaidenName, setShowMaidenName] = useState(Boolean(values.maiden_name));
  const [showBirthDateText, setShowBirthDateText] = useState(Boolean(values.birth_date_text));
  const [showDeathDateText, setShowDeathDateText] = useState(Boolean(values.death_date_text));

  return (
    <div className="card space-y-5">
      <h2 className="text-lg font-semibold">Основные данные</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <label className="field-label">
          Фамилия *
          <input
            className="input"
            value={values.last_name}
            maxLength={SHORT_TEXT_MAX_LENGTH}
            onChange={(e) => setField('last_name', e.target.value)}
            required
          />
        </label>
        <label className="field-label">
          Имя *
          <input
            className="input"
            value={values.first_name}
            maxLength={SHORT_TEXT_MAX_LENGTH}
            onChange={(e) => setField('first_name', e.target.value)}
            required
          />
        </label>
        <label className="field-label">
          Отчество
          <input
            className="input"
            value={values.patronymic}
            maxLength={SHORT_TEXT_MAX_LENGTH}
            onChange={(e) => setField('patronymic', e.target.value)}
          />
        </label>
      </div>

      {/* Maiden name — hidden by default */}
      {!showMaidenName ? (
        <button type="button" className="btn-ghost text-sm text-accent" onClick={() => setShowMaidenName(true)}>
          + Указать девичью фамилию
        </button>
      ) : (
        <label className="field-label max-w-xs">
          Девичья фамилия
          <input
            className="input"
            value={values.maiden_name}
            maxLength={SHORT_TEXT_MAX_LENGTH}
            onChange={(e) => setField('maiden_name', e.target.value)}
          />
        </label>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="field-label">
          Пол
          <select
            className="input"
            value={values.gender}
            onChange={(e) => setField('gender', e.target.value as Gender)}
          >
            <option value="U">Не указан</option>
            <option value="M">Мужской</option>
            <option value="F">Женский</option>
          </select>
        </label>

        <label className="field-label">
          Статус
          <select
            className="input"
            value={values.status}
            onChange={(e) => onStatusChange(e.target.value as PersonStatus)}
            required
          >
            <option value="alive">Жив(а)</option>
            <option value="deceased">Умер(ла)</option>
          </select>
        </label>
      </div>

      {/* Birth date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="field-label">
          Дата рождения
          <input
            className="input"
            type="date"
            value={values.birth_date}
            onChange={(e) => setField('birth_date', e.target.value)}
          />
        </label>
        <label className="field-label">
          Место рождения
          <input
            className="input"
            value={values.birth_place}
            maxLength={SHORT_TEXT_MAX_LENGTH}
            onChange={(e) => setField('birth_place', e.target.value)}
          />
        </label>
      </div>

      {!showBirthDateText ? (
        <button type="button" className="btn-ghost text-sm text-accent" onClick={() => setShowBirthDateText(true)}>
          Дата рождения неизвестна точно?
        </button>
      ) : (
        <label className="field-label max-w-sm">
          Дата рождения (текстом)
          <input
            className="input"
            placeholder="например: около 1920"
            value={values.birth_date_text}
            maxLength={SHORT_TEXT_MAX_LENGTH}
            onChange={(e) => setField('birth_date_text', e.target.value)}
          />
        </label>
      )}

      {/* Death date — visible only when deceased */}
      {isDeceased && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="field-label">
              Дата смерти
              <input
                className="input"
                type="date"
                value={values.death_date}
                onChange={(e) => setField('death_date', e.target.value)}
              />
            </label>
          </div>
          {!showDeathDateText ? (
            <button type="button" className="btn-ghost text-sm text-accent" onClick={() => setShowDeathDateText(true)}>
              Дата смерти неизвестна точно?
            </button>
          ) : (
            <label className="field-label max-w-sm">
              Дата смерти (текстом)
              <input
                className="input"
                value={values.death_date_text}
                maxLength={SHORT_TEXT_MAX_LENGTH}
                onChange={(e) => setField('death_date_text', e.target.value)}
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}

function StepParents({ values, setField, excludePersonId }: StepProps & { excludePersonId?: number }) {
  return (
    <div className="card space-y-5">
      <h2 className="text-lg font-semibold">Родители</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PersonPickerField
          label="Отец"
          value={values.father}
          excludeId={excludePersonId}
          genderFilter="M"
          onChange={(id) => setField('father', id)}
        />
        <PersonPickerField
          label="Мать"
          value={values.mother}
          excludeId={excludePersonId}
          genderFilter="F"
          onChange={(id) => setField('mother', id)}
        />
      </div>
    </div>
  );
}

function StepBurial({
  values,
  setField,
  gravePhoto,
  initialGravePhotoUrl,
  onGravePhotoChange,
  draft,
  onDraftChange,
  isDraftOpen,
  onDraftOpenChange,
  onYmapsReady,
}: StepProps & {
  gravePhoto: File | null;
  initialGravePhotoUrl?: string | null;
  onGravePhotoChange: (f: File | null) => void;
  draft: BurialPlaceDraft;
  onDraftChange: (draft: BurialPlaceDraft) => void;
  isDraftOpen: boolean;
  onDraftOpenChange: (open: boolean) => void;
  onYmapsReady: (instance: YMapsApi) => void;
}) {
  return (
    <div className="card space-y-5">
      <h2 className="text-lg font-semibold">Место захоронения</h2>
      <BurialPlaceField
        value={values.burial_place}
        onChange={(id) => setField('burial_place', id)}
        draft={draft}
        onDraftChange={onDraftChange}
        isDraftOpen={isDraftOpen}
        onDraftOpenChange={onDraftOpenChange}
        onYmapsReady={onYmapsReady}
      />
      <label className="field-label">
        Детали участка
        <input
          className="input"
          placeholder="например: участок 5, ряд 3"
          value={values.burial_plot_details}
          maxLength={SHORT_TEXT_MAX_LENGTH}
          onChange={(e) => setField('burial_plot_details', e.target.value)}
        />
      </label>
      <PhotoUploadField
        label="Фото могилы"
        file={gravePhoto}
        existingUrl={initialGravePhotoUrl}
        onChange={onGravePhotoChange}
      />
    </div>
  );
}

function StepExtras({
  values,
  setField,
  photo,
  initialPhotoUrl,
  onPhotoChange,
}: StepProps & { photo: File | null; initialPhotoUrl?: string | null; onPhotoChange: (f: File | null) => void }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Фото</h2>
        <PhotoUploadField
          label="Портрет"
          file={photo}
          existingUrl={initialPhotoUrl}
          onChange={onPhotoChange}
        />
      </div>

      <ExtraInfoListEditor
        items={values.extra_info}
        onChange={(items) => setField('extra_info', items)}
      />

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Заметки</h2>
        <textarea
          className="input min-h-[120px]"
          value={values.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PersonPickerField (father/mother)
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonPickerFieldProps {
  label: string;
  value: number | '';
  excludeId?: number;
  genderFilter?: 'M' | 'F';
  onChange: (id: number | '') => void;
}

function PersonPickerField({ label, value, excludeId, genderFilter, onChange }: PersonPickerFieldProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const hasValue = typeof value === 'number';
  const { data: selected, isLoading } = usePerson(hasValue ? value : undefined);

  return (
    <div className="field-label">
      {label}
      {hasValue ? (
        <div className="flex items-center gap-2 py-1">
          {isLoading ? (
            <span className="text-text-muted text-sm">Загрузка...</span>
          ) : selected ? (
            <>
              <span className="text-text text-sm">
                {selected.last_name} {selected.first_name} {selected.patronymic}
              </span>
              <button type="button" className="btn-ghost text-xs text-error" onClick={() => onChange('')}>
                Очистить
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary text-sm mt-1"
          onClick={() => setIsSearchOpen(true)}
        >
          + Добавить
        </button>
      )}
      {isSearchOpen && (
        <PersonSearchDialog
          title={`Выбрать: ${label}`}
          genderFilter={genderFilter}
          excludeId={excludeId}
          onSelect={(id) => {
            onChange(id);
            setIsSearchOpen(false);
          }}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </div>
  );
}

interface PersonSearchDialogProps {
  title: string;
  genderFilter?: 'M' | 'F';
  excludeId?: number;
  onSelect: (id: number) => void;
  onClose: () => void;
}

function PersonSearchDialog({ title, genderFilter, excludeId, onSelect, onClose }: PersonSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: results = [], isLoading } = usePersons(
    debouncedQuery.trim()
      ? { search: debouncedQuery.trim(), ...(genderFilter ? { gender: genderFilter } : {}) }
      : undefined,
  );
  const options = results.filter((p) => p.id !== excludeId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    function handleCancel(e: Event) { e.preventDefault(); onClose(); }
    dialog?.addEventListener('cancel', handleCancel);
    return () => {
      dialog?.removeEventListener('cancel', handleCancel);
      if (dialog?.open) dialog.close();
    };
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="person-search-dialog">
      <div className="flex flex-col bg-bg rounded-xl shadow-xl max-w-md w-full mx-auto max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="px-4 py-3">
          <input
            className="input w-full"
            placeholder="Начните вводить имя..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!debouncedQuery.trim() && (
            <p className="text-sm text-text-muted">Введите имя или фамилию для поиска</p>
          )}
          {debouncedQuery.trim() && isLoading && (
            <p className="text-sm text-text-muted">Поиск...</p>
          )}
          {debouncedQuery.trim() && !isLoading && options.length === 0 && (
            <p className="text-sm text-text-muted">Никого не найдено</p>
          )}
          {options.length > 0 && (
            <ul className="picker-results">
              {options.map((person) => (
                <li key={person.id}>
                  <button type="button" onClick={() => onSelect(person.id)}>
                    {person.last_name} {person.first_name} {person.patronymic}
                    {person.birth_date && (
                      <span className="text-text-muted text-xs ml-2">
                        {person.birth_date}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BurialPlaceField + MapPickerDialog
   ═══════════════════════════════════════════════════════════════════════════ */

interface BurialPlaceFieldProps {
  value: number | '';
  onChange: (id: number | '') => void;
  draft: BurialPlaceDraft;
  onDraftChange: (draft: BurialPlaceDraft) => void;
  isDraftOpen: boolean;
  onDraftOpenChange: (open: boolean) => void;
  onYmapsReady: (instance: YMapsApi) => void;
}

// Either picks an existing place or fills in a new one. The new place is NOT
// saved here: the draft belongs to the form and is created together with the
// person (see PersonForm.handleSubmit). Before that, a point picked on the map
// was thrown away unless a separate "create place" button was pressed, which
// is how a person could end up deceased with no grave and invisible on the map.
function BurialPlaceField({
  value,
  onChange,
  draft,
  onDraftChange,
  isDraftOpen,
  onDraftOpenChange,
  onYmapsReady,
}: BurialPlaceFieldProps) {
  const [query, setQuery] = useState('');
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: selected } = useBurialPlaceOption(value);
  const { data: results = [] } = useBurialPlaceSearch(debouncedQuery);

  function setDraftField<K extends keyof BurialPlaceDraft>(key: K, fieldValue: string) {
    onDraftChange({ ...draft, [key]: fieldValue });
  }

  function handleLocationPicked(location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  }) {
    const address = location.address ?? draft.address;
    const city = location.city ?? draft.city;
    onDraftChange({
      ...draft,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      address,
      city,
      name: draft.name || address || city || '',
    });
  }

  const hasCoords = draft.latitude !== '' && draft.longitude !== '';

  return (
    <div className="space-y-3">
      <label className="field-label">
        Место захоронения
        {selected && (
          <div className="flex items-center gap-2 py-1">
            <span className="text-text text-sm">
              {selected.name} {selected.city && `(${selected.city})`}
            </span>
            <button type="button" className="btn-ghost text-xs text-error" onClick={() => onChange('')}>
              Очистить
            </button>
          </div>
        )}
        {!selected && (
          <input
            className="input"
            placeholder="Поиск кладбища/места по названию или городу..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </label>

      {!selected && debouncedQuery.trim() && results.length > 0 && (
        <ul className="picker-results">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(place.id);
                  setQuery('');
                }}
              >
                {place.name} {place.city && `(${place.city})`}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!selected && (
        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={() => onDraftOpenChange(!isDraftOpen)}
        >
          {isDraftOpen ? 'Отменить новое место' : '+ Добавить новое место'}
        </button>
      )}

      {!selected && isDraftOpen && (
        <div className="card space-y-4">
          <p className="text-sm text-text-muted">
            Место сохранится вместе с человеком — отдельно ничего нажимать не нужно.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="field-label">
              Название
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraftField('name', e.target.value)}
              />
            </label>
            <label className="field-label">
              Город
              <input
                className="input"
                value={draft.city}
                onChange={(e) => setDraftField('city', e.target.value)}
              />
            </label>
          </div>
          <label className="field-label">
            Адрес
            <input
              className="input"
              value={draft.address}
              onChange={(e) => setDraftField('address', e.target.value)}
            />
          </label>

          {/* Map point result */}
          {hasCoords && (
            <div className="text-sm text-text-muted bg-bg-muted rounded-lg px-3 py-2">
              Координаты: {draft.latitude}, {draft.longitude}
              {draft.address && <> — {draft.address}</>}
            </div>
          )}

          {hasYandexMapsApiKey() ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setMapDialogOpen(true)}
              >
                {hasCoords ? 'Изменить точку на карте' : 'Указать на карте'}
              </button>
              {!showManualCoords && (
                <button type="button" className="btn-ghost text-sm" onClick={() => setShowManualCoords(true)}>
                  Ввести координаты вручную
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              Карта недоступна (не задан ключ Яндекс.Карт) — укажите координаты вручную.
            </p>
          )}

          {(!hasYandexMapsApiKey() || showManualCoords) && (
            <div className="grid grid-cols-2 gap-3">
              <label className="field-label">
                Широта
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={draft.latitude}
                  onChange={(e) => setDraftField('latitude', e.target.value)}
                  placeholder="55.751244"
                />
              </label>
              <label className="field-label">
                Долгота
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={draft.longitude}
                  onChange={(e) => setDraftField('longitude', e.target.value)}
                  placeholder="37.618423"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Full-screen map dialog */}
      {mapDialogOpen && (
        <MapPickerDialog
          latitude={draft.latitude}
          longitude={draft.longitude}
          onLocationPicked={handleLocationPicked}
          onYmapsReady={onYmapsReady}
          onClose={() => setMapDialogOpen(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MapPickerDialog — full-screen <dialog> with search + map
   ═══════════════════════════════════════════════════════════════════════════ */

interface GeocodedLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

interface MapPickerDialogProps {
  latitude: string;
  longitude: string;
  onLocationPicked: (location: GeocodedLocation) => void;
  onYmapsReady: (instance: YMapsApi) => void;
  onClose: () => void;
}

function MapPickerDialog({
  latitude,
  longitude,
  onLocationPicked,
  onYmapsReady,
  onClose,
}: MapPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    function handleCancel(e: Event) {
      e.preventDefault();
      onClose();
    }
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="map-picker-dialog">
      <div className="flex flex-col h-full bg-bg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold">Укажите точку на карте</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 min-h-0">
          <YMaps query={yandexMapsQuery}>
            <MapPickerContent
              latitude={latitude}
              longitude={longitude}
              onLocationPicked={onLocationPicked}
              onYmapsReady={onYmapsReady}
            />
          </YMaps>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </dialog>
  );
}

interface MapPickerContentProps {
  latitude: string;
  longitude: string;
  onLocationPicked: (location: GeocodedLocation) => void;
  onYmapsReady: (instance: YMapsApi) => void;
}

function MapPickerContent({
  latitude,
  longitude,
  onLocationPicked,
  onYmapsReady,
}: MapPickerContentProps) {
  const ymapsInstance = useYMaps(['geocode']);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (ymapsInstance) onYmapsReady(ymapsInstance);
  }, [ymapsInstance, onYmapsReady]);

  const parsedLat = latitude === '' ? null : Number(latitude);
  const parsedLng = longitude === '' ? null : Number(longitude);
  const hasPoint =
    parsedLat !== null && parsedLng !== null && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng);

  const resolvePoint = useCallback(async (coords: number[]) => {
    const lat = Number(coords[0].toFixed(6));
    const lng = Number(coords[1].toFixed(6));
    let address: string | undefined;
    let city: string | undefined;
    if (ymapsInstance) {
      try {
        const result = await ymapsInstance.geocode(coords);
        const found = result.geoObjects.get(0) as unknown as GeocodeResultLike | null;
        if (found) {
          address = found.getAddressLine();
          city = found.getLocalities()[0] ?? found.getAdministrativeAreas()[0];
        }
      } catch {
        // Fall through — coords alone are still useful
      }
    }
    onLocationPicked({ latitude: lat, longitude: lng, address, city });
  }, [ymapsInstance, onLocationPicked]);

  async function handleSearchAddress() {
    if (!ymapsInstance || !searchQuery.trim()) return;
    try {
      const result = await ymapsInstance.geocode(searchQuery.trim());
      const found = result.geoObjects.get(0) as unknown as GeocodeResultLike | null;
      if (found) {
        const coords = found.geometry?.getCoordinates();
        if (coords) {
          await resolvePoint(coords);
        }
      }
    } catch {
      // Ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-3">
        <input
          className="input flex-1"
          placeholder="Поиск адреса..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearchAddress(); } }}
        />
        <button type="button" className="btn text-sm" onClick={() => void handleSearchAddress()}>
          Найти
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Map
          defaultState={{
            center: hasPoint ? [parsedLat as number, parsedLng as number] : DEFAULT_MAP_CENTER,
            zoom: hasPoint ? FOCUSED_MAP_ZOOM : DEFAULT_MAP_ZOOM,
          }}
          width="100%"
          height="100%"
          onClick={(e: { get: (key: 'coords') => number[] }) => {
            void resolvePoint(e.get('coords'));
          }}
        >
          {hasPoint && (
            <Placemark
              geometry={[parsedLat as number, parsedLng as number]}
              options={{ draggable: true, preset: 'islands#violetIcon' }}
              onDragEnd={(e: {
                get: (key: 'target') => { geometry: { getCoordinates(): number[] | null } | null };
              }) => {
                const coords = e.get('target').geometry?.getCoordinates();
                if (coords) void resolvePoint(coords);
              }}
            />
          )}
        </Map>
      </div>
      {hasPoint && (
        <div className="text-xs text-text-muted p-2 text-center">
          {parsedLat}, {parsedLng}
        </div>
      )}
    </div>
  );
}

import { Clusterer, Map, Placemark, YMaps, useYMaps } from '@pbe/react-yandex-maps';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import {
  FOCUSED_MAP_ZOOM,
  hasYandexMapsApiKey,
  yandexMapsQuery,
} from '@/shared/maps/yandexMapsSetup';
import { getStoredMapViewport, storeMapViewport } from '@/shared/maps/viewportPersistence';
import type { BurialPlace, Gender, PersonStatus } from '@/shared/types';
import { escapeHtml } from '@/shared/utils/escapeHtml';

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
  useAllBurialPlaces,
  useBurialPlace,
  useCreateBurialPlace,
  useCreatePerson,
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
import { formatDisplayDate, parseDateInput } from '@/shared/utils/formatDate';

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
  parents: 'Семья',
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
      if (step === 'burial') setStep('basics');
    }
  }

  const shouldCreatePlaceOnSubmit = isDeceased && values.burial_place === '' && isBurialPlaceDraftFilled(placeDraft);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.last_name.trim() || !values.first_name.trim()) {
      setValidationError('Заполните фамилию и имя.');
      setStep('basics');
      return;
    }

    let submittedValues = values;
    if (shouldCreatePlaceOnSubmit) {
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
      {/* Wizard nav card: tabs + action buttons */}
      <div className="card space-y-4">
        <div className="wizard-sticky-tabs">
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
        </div>

        <div className="items-center border-t border-border pt-3 hidden sm:flex">
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary" onClick={goPrev} disabled={stepIndex === 0}>
              Назад
            </button>
            <button type="button" className="btn btn-secondary" onClick={goNext} disabled={stepIndex >= steps.length - 1}>
              Далее
            </button>
          </div>
          <button type="submit" className="btn ml-auto" disabled={isSubmitting || isSavingPlace}>
            {isSavingPlace ? 'Сохраняем место...' : isSubmitting ? 'Сохранение...' : submitLabel}
          </button>
        </div>

        {validationError && (
          <div className="rounded-lg bg-error/10 text-error text-sm px-3 py-2">
            {validationError}
          </div>
        )}

        <button type="submit" className="btn w-full sm:hidden" disabled={isSubmitting || isSavingPlace}>
          {isSavingPlace ? 'Сохраняем место...' : isSubmitting ? 'Сохранение...' : submitLabel}
        </button>
      </div>

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

      {shouldCreatePlaceOnSubmit && (
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

function DateFieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatDisplayDate(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(formatDisplayDate(value));
  }

  return (
    <label className="field-label">
      {label}
      <div className="date-input-row">
        <input
          className="input"
          value={text}
          inputMode="numeric"
          placeholder="ДД.ММ.ГГГГ"
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const parsed = parseDateInput(next);
            if (parsed !== null) onChange(parsed);
          }}
        />
        <button
          type="button"
          className="date-picker-btn"
          aria-label={`${label}: открыть календарь`}
          onClick={() => {
            const input = pickerRef.current;
            if (!input) return;
            if (typeof input.showPicker === 'function') {
              input.showPicker();
            } else {
              input.click();
            }
          }}
        >
          Календарь
        </button>
        <input
          ref={pickerRef}
          className="sr-only"
          type="date"
          value={value}
          tabIndex={-1}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
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
        <DateFieldInput
          label="Дата рождения"
          value={values.birth_date}
          onChange={(value) => setField('birth_date', value)}
        />
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
            <DateFieldInput
              label="Дата смерти"
              value={values.death_date}
              onChange={(value) => setField('death_date', value)}
            />
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
      <h2 className="text-lg font-semibold">Семья</h2>
      <p className="text-sm text-text-muted -mt-2">
        Можно выбрать уже записанного человека или создать нового прямо здесь.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PersonPickerField
          label="Отец"
          value={values.father}
          excludeId={excludePersonId}
          genderFilter="M"
          lastNameHint={values.last_name}
          onChange={(id) => setField('father', id)}
        />
        <PersonPickerField
          label="Мать"
          value={values.mother}
          excludeId={excludePersonId}
          genderFilter="F"
          lastNameHint={values.last_name}
          onChange={(id) => setField('mother', id)}
        />
      </div>
      <MultiPersonPickerField
        label="Супруг(а)"
        addLabel="+ Добавить супруга"
        values={values.spouses}
        excludeId={excludePersonId}
        lastNameHint={values.last_name}
        onChange={(ids) => setField('spouses', ids)}
      />
      <MultiPersonPickerField
        label="Дети"
        addLabel="+ Добавить ребёнка"
        values={values.children}
        excludeId={excludePersonId}
        lastNameHint={values.last_name}
        onChange={(ids) => setField('children', ids)}
      />
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
  onYmapsReady,
}: StepProps & {
  gravePhoto: File | null;
  initialGravePhotoUrl?: string | null;
  onGravePhotoChange: (f: File | null) => void;
  draft: BurialPlaceDraft;
  onDraftChange: (draft: BurialPlaceDraft) => void;
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
  lastNameHint?: string;
  onChange: (id: number | '') => void;
}

function PersonPickerField({
  label,
  value,
  excludeId,
  genderFilter,
  lastNameHint,
  onChange,
}: PersonPickerFieldProps) {
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
          Выбрать
        </button>
      )}
      {isSearchOpen && (
        <PersonSearchDialog
          title={`Выбрать: ${label}`}
          genderFilter={genderFilter}
          excludeId={excludeId}
          lastNameHint={lastNameHint}
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

function SelectedPersonRow({
  id,
  onRemove,
}: {
  id: number;
  onRemove?: () => void;
}) {
  const { data: selected, isLoading } = usePerson(id);

  if (isLoading) {
    return <span className="text-text-muted text-sm">Загрузка...</span>;
  }
  if (!selected) {
    return (
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-text-muted text-sm">Человек не найден</span>
        {onRemove && (
          <button type="button" className="btn-ghost text-xs text-error" onClick={onRemove}>
            Убрать
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-text text-sm">
        {selected.last_name} {selected.first_name} {selected.patronymic}
      </span>
      {onRemove && (
        <button type="button" className="btn-ghost text-xs text-error" onClick={onRemove}>
          Убрать
        </button>
      )}
    </div>
  );
}

function MultiPersonPickerField({
  label,
  addLabel,
  values,
  excludeId,
  lastNameHint,
  onChange,
}: {
  label: string;
  addLabel: string;
  values: number[];
  excludeId?: number;
  lastNameHint?: string;
  onChange: (ids: number[]) => void;
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className="field-label">
      {label}
      {values.length > 0 ? (
        <div className="rounded-lg border border-border bg-bg px-3 py-2">
          {values.map((id) => (
            <SelectedPersonRow
              key={id}
              id={id}
              onRemove={() => onChange(values.filter((valueId) => valueId !== id))}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">Пока никто не выбран.</p>
      )}
      <button
        type="button"
        className="btn btn-secondary text-sm mt-1 self-start"
        onClick={() => setIsSearchOpen(true)}
      >
        {addLabel}
      </button>
      {isSearchOpen && (
        <PersonSearchDialog
          title={`Выбрать: ${label}`}
          excludeId={excludeId}
          lastNameHint={lastNameHint}
          onSelect={(id) => {
            onChange(values.includes(id) ? values : [...values, id]);
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
  lastNameHint?: string;
  onSelect: (id: number) => void;
  onClose: () => void;
}

function PersonSearchDialog({
  title,
  genderFilter,
  excludeId,
  lastNameHint,
  onSelect,
  onClose,
}: PersonSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [draftLastName, setDraftLastName] = useState(lastNameHint ?? '');
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftPatronymic, setDraftPatronymic] = useState('');
  const [draftGender, setDraftGender] = useState<Gender>(genderFilter ?? 'U');
  const createPerson = useCreatePerson();
  const debouncedQuery = useDebouncedValue(query, 300);
  const hasQuery = debouncedQuery.trim().length > 0;
  const { data: results = [], isLoading } = usePersons(
    hasQuery
      ? { search: debouncedQuery.trim(), ...(genderFilter ? { gender: genderFilter } : {}) }
      : { ...(genderFilter ? { gender: genderFilter } : {}) },
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

  async function handleCreate() {
    if (!draftLastName.trim() || !draftFirstName.trim()) {
      setCreateError('Заполните фамилию и имя.');
      return;
    }
    setCreateError('');
    try {
      const created = await createPerson.mutateAsync({
        values: {
          ...EMPTY_PERSON_FORM_VALUES,
          last_name: draftLastName.trim(),
          first_name: draftFirstName.trim(),
          patronymic: draftPatronymic.trim(),
          gender: draftGender,
        },
        files: { photo: null, gravePhoto: null },
      });
      onSelect(created.id);
    } catch {
      setCreateError('Не удалось создать человека. Попробуйте ещё раз.');
    }
  }

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
          {!isCreating && (
            <>
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
                            {formatDisplayDate(person.birth_date)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="btn-ghost text-sm text-accent mt-2"
                onClick={() => setIsCreating(true)}
              >
                Нет в списке? Создать нового
              </button>
            </>
          )}
          {isCreating && (
            <div className="space-y-3">
              <label className="field-label">
                Фамилия *
                <input
                  className="input"
                  value={draftLastName}
                  onChange={(e) => setDraftLastName(e.target.value)}
                />
              </label>
              <label className="field-label">
                Имя *
                <input
                  className="input"
                  value={draftFirstName}
                  onChange={(e) => setDraftFirstName(e.target.value)}
                />
              </label>
              <label className="field-label">
                Отчество
                <input
                  className="input"
                  value={draftPatronymic}
                  onChange={(e) => setDraftPatronymic(e.target.value)}
                />
              </label>
              <label className="field-label">
                Пол
                <select
                  className="input"
                  value={draftGender}
                  onChange={(e) => setDraftGender(e.target.value as Gender)}
                >
                  <option value="U">Не указан</option>
                  <option value="M">Мужской</option>
                  <option value="F">Женский</option>
                </select>
              </label>
              {createError && (
                <div className="rounded-lg bg-error/10 text-error text-sm px-3 py-2">{createError}</div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn text-sm"
                  disabled={createPerson.isPending}
                  onClick={() => void handleCreate()}
                >
                  {createPerson.isPending ? 'Создание...' : 'Создать и выбрать'}
                </button>
                <button type="button" className="btn-ghost text-sm" onClick={() => setIsCreating(false)}>
                  К поиску
                </button>
              </div>
            </div>
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
  onYmapsReady: (instance: YMapsApi) => void;
}

// The map is the main way to set a place; name/address/coords are optional.
// The new place is NOT saved here: the draft belongs to the form and is created
// together with the person (see PersonForm.handleSubmit). Before that, a point
// picked on the map was thrown away unless a separate "create place" button was
// pressed, which is how a person could end up deceased with no grave.
function BurialPlaceField({
  value,
  onChange,
  draft,
  onDraftChange,
  onYmapsReady,
}: BurialPlaceFieldProps) {
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const { data: selected } = useBurialPlace(value);
  const mapsAvailable = hasYandexMapsApiKey();

  function setDraftField<K extends keyof BurialPlaceDraft>(key: K, fieldValue: string) {
    onDraftChange({ ...draft, [key]: fieldValue });
  }

  function handleLocationPicked(location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  }) {
    if (value !== '') onChange('');
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
  const pickerLatitude =
    draft.latitude || (selected?.latitude != null ? String(selected.latitude) : '');
  const pickerLongitude =
    draft.longitude || (selected?.longitude != null ? String(selected.longitude) : '');

  const manualFields = (
    <div className="space-y-3">
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
    </div>
  );

  return (
    <div className="space-y-4">
      {mapsAvailable ? (
        <div className="space-y-2">
          <button
            type="button"
            className="btn text-sm"
            onClick={() => setMapDialogOpen(true)}
          >
            {hasCoords || selected ? 'Изменить точку на карте' : 'Указать на карте'}
          </button>
          <p className="text-sm text-text-muted">
            Кликните по карте — место сохранится вместе с человеком.
          </p>
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          Карта недоступна (не задан ключ Яндекс.Карт) — укажите координаты вручную.
        </p>
      )}

      {selected && (
        <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-text text-sm">
              {selected.name} {selected.city && `(${selected.city})`}
            </span>
            <button type="button" className="btn-ghost text-xs text-error" onClick={() => onChange('')}>
              Очистить
            </button>
          </div>
          {selected.persons && selected.persons.length > 0 && (
            <>
              <p className="text-xs text-text-muted">Здесь захоронены:</p>
              <ul className="space-y-1">
                {selected.persons.map((person) => (
                  <li key={person.id} className="text-sm">
                    <a href={`/person/${person.id}`} className="text-accent hover:underline">
                      {[person.last_name, person.first_name, person.patronymic].filter(Boolean).join(' ')}
                    </a>
                    {person.birth_date && (
                      <span className="text-text-muted ml-2 text-xs">
                        {person.birth_date}
                        {person.death_date && ` — ${person.death_date}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {!selected && hasCoords && (
        <div className="text-sm text-text-muted bg-bg-muted rounded-lg px-3 py-2">
          Координаты: {draft.latitude}, {draft.longitude}
          {draft.address && <> — {draft.address}</>}
        </div>
      )}

      {!selected && (mapsAvailable ? (
        <details>
          <summary className="cursor-pointer text-sm text-text-muted hover:text-text">
            Указать вручную
          </summary>
          <div className="mt-3">{manualFields}</div>
        </details>
      ) : (
        manualFields
      ))}

      {mapDialogOpen && (
        <MapPickerDialog
          latitude={pickerLatitude}
          longitude={pickerLongitude}
          onLocationPicked={handleLocationPicked}
          onExistingPlaceSelected={(id) => {
            onChange(id);
            onDraftChange(EMPTY_BURIAL_PLACE_DRAFT);
            setMapDialogOpen(false);
          }}
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
  onExistingPlaceSelected: (id: number) => void;
  onYmapsReady: (instance: YMapsApi) => void;
  onClose: () => void;
}

function MapPickerDialog({
  latitude,
  longitude,
  onLocationPicked,
  onExistingPlaceSelected,
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
              onExistingPlaceSelected={onExistingPlaceSelected}
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
  onExistingPlaceSelected: (id: number) => void;
  onYmapsReady: (instance: YMapsApi) => void;
}

function buildPickerBalloonContent(place: BurialPlace): string {
  const persons = place.persons ?? [];
  let html = '';
  if (persons.length > 0) {
    const items = persons
      .map((p) => {
        const name = escapeHtml(
          [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' '),
        );
        return `<li>${name}</li>`;
      })
      .join('');
    html += `<ul class="map-balloon-persons">${items}</ul>`;
  } else {
    html += '<p>Нет привязанных записей.</p>';
  }
  html += `<button class="map-balloon-select-btn" data-place-id="${place.id}">Выбрать это место</button>`;
  return html;
}

function MapPickerContent({
  latitude,
  longitude,
  onLocationPicked,
  onExistingPlaceSelected,
  onYmapsReady,
}: MapPickerContentProps) {
  const ymapsInstance = useYMaps(['geocode']);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: allPlaces = [] } = useAllBurialPlaces();
  const initialViewport = getStoredMapViewport();

  const placeableLocations = useMemo(
    () => allPlaces.filter(
      (p) =>
        Number.isFinite(Number(p.latitude)) &&
        Number.isFinite(Number(p.longitude)) &&
        p.persons &&
        p.persons.length > 0,
    ),
    [allPlaces],
  );

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
    storeMapViewport({ center: [lat, lng], zoom: FOCUSED_MAP_ZOOM });
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

  useEffect(() => {
    function handleBalloonBtnClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.map-balloon-select-btn');
      if (!btn) return;
      const placeId = Number(btn.dataset.placeId);
      if (placeId) onExistingPlaceSelected(placeId);
    }
    document.addEventListener('click', handleBalloonBtnClick);
    return () => document.removeEventListener('click', handleBalloonBtnClick);
  }, [onExistingPlaceSelected]);

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
            center: hasPoint ? [parsedLat as number, parsedLng as number] : initialViewport.center,
            zoom: hasPoint ? FOCUSED_MAP_ZOOM : initialViewport.zoom,
          }}
          width="100%"
          height="100%"
          onClick={(e: { get: (key: 'coords') => number[] }) => {
            void resolvePoint(e.get('coords'));
          }}
          modules={['control.ZoomControl']}
          onBoundsChange={(e: { get: (key: 'newCenter' | 'newZoom') => [number, number] | number }) => {
            const center = e.get('newCenter');
            const zoom = e.get('newZoom');
            if (Array.isArray(center) && typeof zoom === 'number') {
              storeMapViewport({ center: [Number(center[0]), Number(center[1])], zoom });
            }
          }}
        >
          <Clusterer
            options={{ preset: 'islands#invertedVioletClusterIcons' }}
            modules={['clusterer.addon.balloon']}
          >
            {placeableLocations.map((place) => (
              <Placemark
                key={place.id}
                geometry={[Number(place.latitude), Number(place.longitude)]}
                modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                properties={{
                  hintContent: `${place.name}${place.city ? ` (${place.city})` : ''}`,
                  balloonContentHeader: escapeHtml(place.name),
                  balloonContentBody: buildPickerBalloonContent(place),
                }}
                options={{
                  preset: 'islands#violetDotIcon',
                  balloonAutoPan: true,
                  balloonMaxWidth: window.innerWidth >= 640 ? 400 : 250,
                }}
              />
            ))}
          </Clusterer>
          {hasPoint && (
            <Placemark
              geometry={[parsedLat as number, parsedLng as number]}
              options={{ draggable: true, preset: 'islands#redIcon', zIndex: 1000 }}
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

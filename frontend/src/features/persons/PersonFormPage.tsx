import { useNavigate, useParams } from 'react-router-dom';
import type { Person } from '@/shared/types';
import { PersonForm } from './PersonForm';
import { useCreatePerson, usePerson, useUpdatePerson } from './hooks';
import { EMPTY_PERSON_FORM_VALUES, type PersonFormValues } from './types';
import type { PersonSubmitFiles } from './api';
import { useState } from 'react';

interface ChildrenConflictError {
  children?: string;
  linked_user?: string;
  children_conflicts?: Array<{
    id: number;
    name: string;
    field: 'father' | 'mother';
    current_parent_id: number;
  }>;
}

function personToFormValues(person: Person): PersonFormValues {
  return {
    first_name: person.first_name,
    last_name: person.last_name,
    patronymic: person.patronymic,
    maiden_name: person.maiden_name,
    gender: person.gender,
    birth_date: person.birth_date ?? '',
    birth_date_text: person.birth_date_text,
    birth_place: person.birth_place,
    status: person.status,
    death_date: person.death_date ?? '',
    death_date_text: person.death_date_text,
    father: person.father ?? '',
    mother: person.mother ?? '',
    children: person.children.map((child) => child.id),
    burial_place: person.burial_place ?? '',
    burial_plot_details: person.burial_plot_details,
    notes: person.notes,
    extra_info: person.extra_info,
    force_children_reassign: false,
  };
}

export function PersonFormPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = params.id !== undefined;
  const personId = isEditMode ? Number(params.id) : undefined;

  const { data: existingPerson, isLoading } = usePerson(personId);
  const createMutation = useCreatePerson();
  const updateMutation = useUpdatePerson();
  const [errorText, setErrorText] = useState('');

  function maybeRetryWithConfirmedChildren(
    values: PersonFormValues,
    files: PersonSubmitFiles,
    error: unknown,
  ): boolean {
    const detail = (error as { response?: { data?: ChildrenConflictError } })?.response?.data;
    if (!detail?.children_conflicts || detail.children_conflicts.length === 0) {
      setErrorText(detail?.children || detail?.linked_user || 'Не удалось сохранить. Проверьте введённые данные.');
      return false;
    }

    const lines = detail.children_conflicts.map((conflict) => `• ${conflict.name}`);
    const confirmed = window.confirm(
      `У некоторых выбранных детей уже заполнен ${detail.children_conflicts[0].field === 'father' ? 'отец' : 'мать'}:\n\n${lines.join('\n')}\n\nЗаменить на текущего человека?`,
    );
    if (!confirmed) {
      setErrorText('Сохранение отменено из-за конфликта родителей.');
      return true;
    }

    const forcedValues: PersonFormValues = {
      ...values,
      force_children_reassign: true,
    };
    if (isEditMode && personId !== undefined) {
      updateMutation.mutate(
        { id: personId, values: forcedValues, files },
        { onSuccess: (person) => navigate(`/person/${person.id}`), onError: () => setErrorText('Не удалось сохранить после подтверждения.') },
      );
    } else {
      createMutation.mutate(
        { values: forcedValues, files },
        { onSuccess: (person) => navigate(`/person/${person.id}`), onError: () => setErrorText('Не удалось сохранить после подтверждения.') },
      );
    }
    return true;
  }

  function handleSubmit(values: PersonFormValues, files: PersonSubmitFiles) {
    setErrorText('');
    const submitValues: PersonFormValues = {
      ...values,
      force_children_reassign: false,
    };
    if (isEditMode && personId !== undefined) {
      updateMutation.mutate(
        { id: personId, values: submitValues, files },
        {
          onSuccess: (person) => navigate(`/person/${person.id}`),
          onError: (error) => {
            maybeRetryWithConfirmedChildren(submitValues, files, error);
          },
        },
      );
    } else {
      createMutation.mutate(
        { values: submitValues, files },
        {
          onSuccess: (person) => navigate(`/person/${person.id}`),
          onError: (error) => {
            maybeRetryWithConfirmedChildren(submitValues, files, error);
          },
        },
      );
    }
  }

  if (isEditMode && isLoading) return <p className="text-text-muted p-8">Загрузка...</p>;
  if (isEditMode && !existingPerson) return <p className="text-error p-8">Не удалось загрузить данные человека.</p>;

  const mutation = isEditMode ? updateMutation : createMutation;

  return (
    <div className="max-w-3xl w-full">
      <div className="card mb-6">
        <h1 className="text-2xl font-bold">{isEditMode ? 'Редактирование' : 'Новый человек'}</h1>
      </div>
      <PersonForm
        initialValues={
          isEditMode && existingPerson
            ? personToFormValues(existingPerson)
            : EMPTY_PERSON_FORM_VALUES
        }
        initialPhotoUrl={existingPerson?.photo}
        initialGravePhotoUrl={existingPerson?.grave_photo}
        excludePersonId={personId}
        isSubmitting={mutation.isPending}
        submitLabel={isEditMode ? 'Сохранить изменения' : 'Создать'}
        onSubmit={handleSubmit}
      />
      {(mutation.isError || errorText) && (
        <div className="rounded-lg bg-error/10 text-error text-sm px-3 py-2 mt-4">
          {errorText || 'Не удалось сохранить. Проверьте введённые данные.'}
        </div>
      )}
    </div>
  );
}

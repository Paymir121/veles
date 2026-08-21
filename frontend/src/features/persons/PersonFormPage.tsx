import { useNavigate, useParams } from 'react-router-dom';
import { PersonForm } from './PersonForm';
import { useCreatePerson, usePerson, useUpdatePerson } from './hooks';
import { EMPTY_PERSON_FORM_VALUES, personToFormValues, type PersonFormValues } from './types';
import type { PersonSubmitFiles } from './api';
import { useState } from 'react';
import { childrenConflictMessage, savePersonErrorText, withForcedChildren } from './personSave';

export function PersonFormPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = params.id !== undefined;
  const personId = isEditMode ? Number(params.id) : undefined;

  const { data: existingPerson, isLoading } = usePerson(personId);
  const createMutation = useCreatePerson();
  const updateMutation = useUpdatePerson();
  const [errorText, setErrorText] = useState('');

  function goToPerson(id: number) {
    navigate(`/person/${id}`);
  }

  function retryAfterConflict(
    values: PersonFormValues,
    files: PersonSubmitFiles,
    error: unknown,
  ): boolean {
    const conflict = childrenConflictMessage(error);
    if (!conflict) {
      setErrorText(savePersonErrorText(error));
      return false;
    }
    if (!window.confirm(conflict)) {
      setErrorText('Сохранение отменено из-за конфликта родителей.');
      return true;
    }

    const forcedValues = withForcedChildren(values);
    if (isEditMode && personId !== undefined) {
      updateMutation.mutate(
        { id: personId, values: forcedValues, files },
        {
          onSuccess: (person) => goToPerson(person.id),
          onError: () => setErrorText('Не удалось сохранить после подтверждения.'),
        },
      );
    } else {
      createMutation.mutate(
        { values: forcedValues, files },
        {
          onSuccess: (person) => goToPerson(person.id),
          onError: () => setErrorText('Не удалось сохранить после подтверждения.'),
        },
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
          onSuccess: (person) => goToPerson(person.id),
          onError: (error) => {
            retryAfterConflict(submitValues, files, error);
          },
        },
      );
    } else {
      createMutation.mutate(
        { values: submitValues, files },
        {
          onSuccess: (person) => goToPerson(person.id),
          onError: (error) => {
            retryAfterConflict(submitValues, files, error);
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
        <h1 className="text-2xl font-bold">
          {isEditMode && existingPerson
            ? `Редактирование: ${[existingPerson.last_name, existingPerson.first_name].filter(Boolean).join(' ')}`
            : 'Новый человек'}
        </h1>
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

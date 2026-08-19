import { useNavigate, useParams } from 'react-router-dom';
import type { Person } from '@/shared/types';
import { PersonForm } from './PersonForm';
import { useCreatePerson, usePerson, useUpdatePerson } from './hooks';
import { EMPTY_PERSON_FORM_VALUES, type PersonFormValues } from './types';
import type { PersonSubmitFiles } from './api';

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
    burial_place: person.burial_place ?? '',
    burial_plot_details: person.burial_plot_details,
    notes: person.notes,
    extra_info: person.extra_info,
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

  function handleSubmit(values: PersonFormValues, files: PersonSubmitFiles) {
    if (isEditMode && personId !== undefined) {
      updateMutation.mutate(
        { id: personId, values, files },
        { onSuccess: (person) => navigate(`/person/${person.id}`) },
      );
    } else {
      createMutation.mutate(
        { values, files },
        { onSuccess: (person) => navigate(`/person/${person.id}`) },
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
      {mutation.isError && (
        <div className="rounded-lg bg-error/10 text-error text-sm px-3 py-2 mt-4">
          Не удалось сохранить. Проверьте введённые данные.
        </div>
      )}
    </div>
  );
}

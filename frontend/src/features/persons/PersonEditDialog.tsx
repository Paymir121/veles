import { useEffect, useRef, useState } from 'react';
import { PersonForm } from './PersonForm';
import { usePerson, useUpdatePerson } from './hooks';
import { personToFormValues } from './types';
import type { PersonSubmitFiles } from './api';
import {
  childrenConflictMessage,
  savePersonErrorText,
  withForcedChildren,
} from './personSave';
import type { PersonFormValues } from './types';

interface PersonEditDialogProps {
  personId: number;
  onClose: () => void;
}

export function PersonEditDialog({ personId, onClose }: PersonEditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { data: person, isLoading, isError } = usePerson(personId);
  const updateMutation = useUpdatePerson();
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    function handleCancel(event: Event) {
      event.preventDefault();
      onClose();
    }
    dialog?.addEventListener('cancel', handleCancel);
    return () => {
      dialog?.removeEventListener('cancel', handleCancel);
      if (dialog?.open) dialog.close();
    };
  }, [onClose]);

  function save(values: PersonFormValues, files: PersonSubmitFiles) {
    setErrorText('');
    updateMutation.mutate(
      { id: personId, values, files },
      {
        onSuccess: onClose,
        onError: (error) => {
          const conflict = childrenConflictMessage(error);
          if (!conflict) {
            setErrorText(savePersonErrorText(error));
            return;
          }
          if (!window.confirm(conflict)) {
            setErrorText('Сохранение отменено из-за конфликта родителей.');
            return;
          }
          updateMutation.mutate(
            { id: personId, values: withForcedChildren(values), files },
            {
              onSuccess: onClose,
              onError: () => setErrorText('Не удалось сохранить после подтверждения.'),
            },
          );
        },
      },
    );
  }

  const title = person
    ? `Редактирование: ${[person.last_name, person.first_name].filter(Boolean).join(' ')}`
    : 'Редактирование';

  return (
    <dialog ref={dialogRef} className="person-edit-dialog" aria-labelledby="person-edit-dialog-title">
      <div className="person-edit-dialog-shell">
        <header className="person-edit-dialog-header">
          <h2 id="person-edit-dialog-title" className="text-lg font-semibold truncate min-w-0">
            {title}
          </h2>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Закрыть
          </button>
        </header>
        <div className="person-edit-dialog-body">
          {isLoading && <p className="text-text-muted p-2">Загрузка...</p>}
          {isError && (
            <p className="text-error p-2">Не удалось загрузить данные человека.</p>
          )}
          {person && (
            <PersonForm
              initialValues={personToFormValues(person)}
              initialPhotoUrl={person.photo}
              initialGravePhotoUrl={person.grave_photo}
              excludePersonId={person.id}
              isSubmitting={updateMutation.isPending}
              submitLabel="Сохранить изменения"
              onSubmit={save}
            />
          )}
          {(updateMutation.isError || errorText) && (
            <div className="rounded-lg bg-error/10 text-error text-sm px-3 py-2 mt-4">
              {errorText || 'Не удалось сохранить. Проверьте введённые данные.'}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

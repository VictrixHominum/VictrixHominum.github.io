import { useEffect, useRef, useCallback } from 'react';
import { Button } from './Button';

export interface UnsavedChangesModalProps {
  open: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  open,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    },
    [onCancel, saving],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
      aria-describedby="unsaved-modal-message"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onCancel}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-xl border border-surface-300 bg-surface-50 p-6 shadow-2xl">
        <h2
          id="unsaved-modal-title"
          className="text-lg font-semibold text-gray-100 mb-2"
        >
          Unsaved changes
        </h2>
        <p
          id="unsaved-modal-message"
          className="text-sm text-gray-400 mb-6 leading-relaxed"
        >
          You have unsaved changes. Would you like to save before leaving?
        </p>

        <div className="flex items-center justify-end gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            loading={saving}
            disabled={saving}
          >
            Save & Exit
          </Button>
        </div>
      </div>
    </div>
  );
}

import { AlertTriangle } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon ${variant === 'danger' ? 'confirm-danger' : 'confirm-primary'}`}>
          <AlertTriangle size={26} />
        </div>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel}>{cancelLabel}</button>
          <button className={variant === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

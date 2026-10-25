import { useEffect, useRef } from 'react';

export default function SimpleDialog({ isOpen, onClose, busy = false, labelledBy, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);
  return (
    <dialog ref={ref} className={`simple-dialog ${className}`} aria-labelledby={labelledBy}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => {
        if (busy || event.target !== ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      {isOpen && children}
    </dialog>
  );
}

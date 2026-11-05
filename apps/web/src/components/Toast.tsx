import { useState, useEffect } from 'preact/hooks';

type ToastListener = (msg: string) => void;
const listeners = new Set<ToastListener>();

export function showToast(message: string) {
  listeners.forEach(fn => fn(message));
}

export function ToastContainer() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number;
    const handler: ToastListener = (msg) => {
      setToastMessage(msg);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setToastMessage(null);
      }, 2600);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      window.clearTimeout(timer);
    };
  }, []);

  if (!toastMessage) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <div className="toast">
        {toastMessage}
      </div>
    </div>
  );
}
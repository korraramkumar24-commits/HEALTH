import { useEffect } from 'react';

const Toast = ({ message, onDismiss }) => {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div role="status" aria-live="polite" className="fixed right-4 top-20 z-50 flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-emerald-800 bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-xl sm:right-6">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="rounded px-1 text-lg leading-5 hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">×</button>
    </div>
  );
};

export default Toast;

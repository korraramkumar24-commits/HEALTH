const ErrorNotice = ({ message, onRetry, className = 'mb-4' }) => {
  if (!message) return null;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950 ${className}`} role="alert">
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="rounded px-1 font-bold underline underline-offset-2 hover:text-red-800">Retry</button>}
    </div>
  );
};

export default ErrorNotice;

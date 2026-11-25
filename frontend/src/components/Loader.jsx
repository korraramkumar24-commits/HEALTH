const Loader = ({ label = 'Loading...' }) => (
  <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-semibold text-slate-700" role="status" aria-live="polite">
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 animate-spin text-indigo-800" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
    <span>{label}</span>
  </div>
);

export default Loader;

const Unauthorized = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
    <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Access denied</p>
      <h1 className="text-3xl font-bold text-slate-900">Unauthorized</h1>
      <p className="mt-3 text-slate-600">You do not have permission to view this page.</p>
      <a href="/login" className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        Return to login
      </a>
    </div>
  </div>
);

export default Unauthorized;

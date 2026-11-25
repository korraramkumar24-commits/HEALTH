const EmptyState = ({ title = 'Nothing here yet', description = 'Try changing your filters.' }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
    <h3 className="font-semibold text-slate-800">{title}</h3>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
);

export default EmptyState;

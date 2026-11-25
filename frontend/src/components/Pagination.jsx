const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-between">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
};

export default Pagination;

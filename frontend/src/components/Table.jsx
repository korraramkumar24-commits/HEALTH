import EmptyState from './EmptyState';

const Table = ({ columns, rows, rowKey = '_id', emptyTitle }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
    {rows.length === 0 ? (
      <div className="p-5"><EmptyState title={emptyTitle || 'No records found'} /></div>
    ) : (
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row[rowKey]} className="hover:bg-slate-50/70">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 align-middle text-slate-700">
                  {column.render ? column.render(row) : row[column.key] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export default Table;

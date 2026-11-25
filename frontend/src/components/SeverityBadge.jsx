const severityStyles = {
  low: 'bg-sky-100 text-sky-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${severityStyles[severity] || 'bg-slate-100 text-slate-700'}`}>
    {severity}
  </span>
);

export default SeverityBadge;

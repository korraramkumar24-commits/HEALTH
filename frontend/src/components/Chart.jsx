import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import EmptyState from './EmptyState';
import Loader from './Loader';

const COLORS = ['#1fd2ff', '#1f62ff', '#4c1fff', '#22c55e', '#f59e0b'];
const PIE_COLORS = {
  normal: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  low: '#1fd2ff',
  medium: '#f59e0b',
  high: '#ef4444',
  unread: '#1f62ff',
  acknowledged: '#f59e0b',
  resolved: '#22c55e',
};

const Chart = ({
  data = [],
  dataKey,
  dataKeys,
  title,
  unit = '',
  loading = false,
  type = 'line',
  nameKey = 'name',
  xKey = 'recordedAt',
  emptyMessage = 'Measurements will appear here when available.',
}) => {
  const keys = dataKeys || (Array.isArray(dataKey) ? dataKey : dataKey ? [dataKey] : []);
  const hasValues = type === 'pie'
    ? data.some((item) => Number(item.value) > 0)
    : data.some((item) => keys.some((key) => Number.isFinite(item[key])));

  const formatXAxis = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const formatTooltip = (value) =>
    value == null ? 'No reading' : `${value}${unit ? ` ${unit}` : ''}`;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="chart-title mb-4 text-lg font-bold text-slate-900">{title}</h2>
      {loading ? <Loader label={`Loading ${title.toLowerCase()}...`} /> : !hasValues ? (
        <EmptyState title="No data for this period" description={emptyMessage} />
      ) : (
        <div className="h-72 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            {type === 'pie' ? (
              <PieChart>
                <Tooltip formatter={formatTooltip} />
                <Legend />
                <Pie data={data} dataKey="value" nameKey={nameKey} innerRadius="55%" outerRadius="78%" paddingAngle={3}>
                  {data.map((entry) => (
                    <Cell key={entry[nameKey]} fill={PIE_COLORS[entry[nameKey]] || COLORS[0]} />
                  ))}
                </Pie>
              </PieChart>
            ) : type === 'bar' ? (
              <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey={xKey} tickFormatter={formatXAxis} minTickGap={24} stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563', color: '#f9fafb' }} formatter={formatTooltip} labelFormatter={formatXAxis} />
                {keys.length > 1 && <Legend />}
                {keys.map((key, index) => (
                  <Bar key={key} dataKey={key} name={key} fill={COLORS[index % COLORS.length]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey={xKey} tickFormatter={formatXAxis} minTickGap={24} stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563', color: '#f9fafb' }} formatter={formatTooltip} labelFormatter={formatXAxis} />
                {keys.length > 1 && <Legend />}
                {keys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export default Chart;

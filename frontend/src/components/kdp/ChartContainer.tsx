import { ReactNode } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export interface ChartData {
  [key: string]: string | number;
}

export interface ChartSeries {
  dataKey: string;
  name: string;
  color: string;
  type?: 'line' | 'bar' | 'area';
}

interface ChartContainerProps {
  data: ChartData[];
  series: ChartSeries[];
  type?: 'line' | 'bar' | 'area' | 'mixed';
  title?: string;
  subtitle?: string;
  xAxisKey: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  className?: string;
  actions?: ReactNode;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-white mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="text-white font-medium">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ChartContainer({
  data,
  series,
  type = 'line',
  title,
  subtitle,
  xAxisKey,
  height = 400,
  showLegend = true,
  showGrid = true,
  className = '',
  actions
}: ChartContainerProps) {
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 }
    };

    const axisStyle = {
      fontSize: 12,
      fill: '#9CA3AF'
    };

    const gridStyle = {
      stroke: '#374151',
      strokeDasharray: '3 3'
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid {...gridStyle} />}
            <XAxis dataKey={xAxisKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map(s => (
              <Bar key={s.dataKey} dataKey={s.dataKey} fill={s.color} name={s.name} />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid {...gridStyle} />}
            <XAxis dataKey={xAxisKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map(s => (
              <Area
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.2}
                name={s.name}
              />
            ))}
          </AreaChart>
        );

      case 'mixed':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid {...gridStyle} />}
            <XAxis dataKey={xAxisKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map(s => {
              if (s.type === 'bar') {
                return <Bar key={s.dataKey} dataKey={s.dataKey} fill={s.color} name={s.name} />;
              }
              return (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ fill: s.color, r: 4 }}
                  name={s.name}
                />
              );
            })}
          </LineChart>
        );

      case 'line':
      default:
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid {...gridStyle} />}
            <XAxis dataKey={xAxisKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map(s => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                dot={{ fill: s.color, r: 4 }}
                activeDot={{ r: 6 }}
                name={s.name}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      {/* Header */}
      {(title || subtitle || actions) && (
        <div className="mb-6 flex items-start justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="flex items-center justify-center h-full min-h-[300px]">
          <p className="text-gray-400 text-center">
            No data available to display
          </p>
        </div>
      )}
    </div>
  );
}

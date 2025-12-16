import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  variant = 'default',
  className = ''
}: StatsCardProps) {
  const variantStyles = {
    default: 'bg-gray-900 border-gray-700',
    primary: 'bg-orange-500/10 border-orange-500/30',
    success: 'bg-green-500/10 border-green-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    danger: 'bg-red-500/10 border-red-500/30',
  };

  const iconColors = {
    default: 'text-gray-400',
    primary: 'text-orange-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
  };

  return (
    <div className={`rounded-xl p-6 border ${variantStyles[variant]} hover:bg-gray-800 transition-colors ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-white">
              {value}
            </p>
            {trend && (
              <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={`${iconColors[variant]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';

interface FilterBarProps {
  onFilterChange: (filters: FilterValues) => void;
  showDateRange?: boolean;
  showTimePeriod?: boolean;
  showExtraFilters?: boolean;
  extraFiltersOptions?: ExtraFilter[];
}

export interface FilterValues {
  startDate?: string;
  endDate?: string;
  timePeriod?: string;
  extraFilters?: Record<string, string | string[]>;
}

export interface ExtraFilter {
  name: string;
  label: string;
  type: 'text' | 'select' | 'multiselect';
  options?: { value: string; label: string }[];
}

export default function FilterBar({
  onFilterChange,
  showDateRange = true,
  showTimePeriod = true,
  showExtraFilters = true,
  extraFiltersOptions = []
}: FilterBarProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timePeriod, setTimePeriod] = useState('last30days');
  const [showExtraPanel, setShowExtraPanel] = useState(false);
  const [extraFilters, setExtraFilters] = useState<Record<string, string | string[]>>({});

  const timePeriodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const handleApplyFilters = () => {
    onFilterChange({
      startDate,
      endDate,
      timePeriod,
      extraFilters
    });
  };

  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value);

    // Auto-calculate date range based on time period
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (value) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'yesterday':
        start = new Date(today.setDate(today.getDate() - 1));
        end = start;
        break;
      case 'last7days':
        start = new Date(today.setDate(today.getDate() - 7));
        end = new Date();
        break;
      case 'last30days':
        start = new Date(today.setDate(today.getDate() - 30));
        end = new Date();
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date();
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }

    if (value !== 'custom') {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        {/* Date Range */}
        {showDateRange && (
          <>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>
          </>
        )}

        {/* Time Period */}
        {showTimePeriod && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Time Period
            </label>
            <select
              value={timePeriod}
              onChange={(e) => handleTimePeriodChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            >
              {timePeriodOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Extra Filters Button */}
        {showExtraFilters && extraFiltersOptions.length > 0 && (
          <button
            onClick={() => setShowExtraPanel(!showExtraPanel)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            {showExtraPanel ? 'Hide' : 'Add'} Extra Filters
          </button>
        )}

        {/* Apply Button */}
        <button
          onClick={handleApplyFilters}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
        >
          Apply Filters
        </button>
      </div>

      {/* Extra Filters Panel */}
      {showExtraPanel && extraFiltersOptions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {extraFiltersOptions.map(filter => (
              <div key={filter.name}>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {filter.label}
                </label>
                {filter.type === 'select' && (
                  <select
                    value={extraFilters[filter.name] as string || ''}
                    onChange={(e) => setExtraFilters({ ...extraFilters, [filter.name]: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  >
                    <option value="">All</option>
                    {filter.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
                {filter.type === 'text' && (
                  <input
                    type="text"
                    value={extraFilters[filter.name] as string || ''}
                    onChange={(e) => setExtraFilters({ ...extraFilters, [filter.name]: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    placeholder={`Enter ${filter.label.toLowerCase()}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

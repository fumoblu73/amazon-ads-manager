import { NavLink } from 'react-router-dom';

export default function KdpNav() {
  const navItems = [
    { path: '/kdp/dashboard', label: 'Overview', icon: 'Visual' },
    { path: '/kdp/bookshelf', label: 'Bookshelf & BSRs' },
    { path: '/kdp/analytics/historical', label: 'Historical Stats' },
    { path: '/kdp/analytics/book-stats', label: 'Book Stats' },
    { path: '/kdp/analytics/country', label: 'Country Stats' },
    { path: '/kdp/analytics/month-comparison', label: 'Month Comparison' },
  ];

  return (
    <div className="bg-gray-900 border-b border-gray-700">
      <div className="flex items-center gap-2 px-8 py-5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `px-6 py-3 rounded-lg text-base font-semibold transition-all ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            {item.icon && (
              <span className="inline-block bg-purple-600 text-white text-xs px-2.5 py-1 rounded mr-2">
                {item.icon}
              </span>
            )}
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

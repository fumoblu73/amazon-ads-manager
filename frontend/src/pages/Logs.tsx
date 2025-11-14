import { useEffect, useState } from 'react';
import { logsApi } from '../services/api';
import type { AutomationLog } from '../types';

export default function Logs() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await logsApi.getRecent(100);
        if (response.success && response.data) {
          setLogs(response.data);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (statusFilter === 'all') return true;
    return log.status === statusFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('pause')) return 'bg-red-100 text-red-800';
    if (action.includes('increase')) return 'bg-green-100 text-green-800';
    if (action.includes('decrease')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('add')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600">Caricamento log...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Tutti ({logs.length})
          </button>
          <button
            onClick={() => setStatusFilter('success')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              statusFilter === 'success'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Successi ({logs.filter(l => l.status === 'success').length})
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              statusFilter === 'failed'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Falliti ({logs.filter(l => l.status === 'failed').length})
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">Nessun log trovato</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">
                    Funzione
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">
                    Azione
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">
                    Modifiche
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">
                    Stato
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 font-medium bg-indigo-100 text-indigo-800 rounded">
                        {log.ruleName}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 font-medium rounded ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <div className="font-medium text-gray-900 truncate">{log.targetName}</div>
                      <div className="text-gray-500 truncate">{log.targetId}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                      {log.oldValue !== null && log.newValue !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">{log.oldValue}</span>
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-gray-900">{log.newValue}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 font-semibold rounded ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.status === 'success' ? 'OK' : 'ERR'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

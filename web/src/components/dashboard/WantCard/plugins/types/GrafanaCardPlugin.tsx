import React, { useMemo } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';

const GrafanaContentSection: React.FC<WantCardPluginProps> = ({ want, isExpanded }) => {
  const goal = (want.state as any)?.goal ?? {};
  const current = (want.state as any)?.current ?? {};

  const baseUrl = (goal.grafana_base_url as string | undefined)?.replace(/\/$/, '') || 'http://localhost:3000';
  const dashboardUid = (goal.dashboard_uid as string | undefined) || '';
  const panelId = goal.panel_id ?? 1;
  const timeFrom = (goal.time_from as string | undefined) || 'now-6h';
  const refresh = (goal.refresh as string | undefined) || '30s';
  const status = (current.grafana_status as string | undefined) || 'unknown';

  const src = useMemo(() => {
    if (!dashboardUid) return '';
    const params = new URLSearchParams({
      orgId: '1',
      panelId: String(panelId),
      from: timeFrom,
      to: 'now',
      refresh,
    });
    return `${baseUrl}/d-solo/${dashboardUid}?${params}`;
  }, [baseUrl, dashboardUid, panelId, timeFrom, refresh]);

  if (!dashboardUid) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4">
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <div>Set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">dashboard_uid</code> and <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">panel_id</code> in params</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <iframe
        src={src}
        className="w-full flex-1 min-h-0 border-0"
        style={{ height: isExpanded ? '100%' : '100%' }}
        title={want.metadata?.name ?? 'Grafana Panel'}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
      {status !== 'ok' && status !== 'unknown' && (
        <div className="text-red-500 dark:text-red-400 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 shrink-0 truncate">
          {status}
        </div>
      )}
    </div>
  );
};

registerWantCardPlugin({
  types: ['grafana_panel'],
  ContentSection: GrafanaContentSection,
  hideFinalResult: true,
});

// app/components/KpiSelector.tsx
"use client";

import React from 'react';

interface KpiCardConfig {
  title: string;
  metric: string;
}

interface KpiSelectorProps {
  availableMetrics: string[];
  selectedKpis: KpiCardConfig[];
  onChange: (newKpiConfig: KpiCardConfig[]) => void;
}

export default function KpiSelector({ availableMetrics, selectedKpis, onChange }: KpiSelectorProps) {

  const selectedMetrics = selectedKpis.map(kpi => kpi.metric);

  const handleToggle = (metric: string, isChecked: boolean) => {
    let newKpiConfig;
    if (isChecked) {
      // Add the new KPI card to the list
      const newKpi = {
        title: metric.replace(/_/g, ' '),
        metric: metric,
      };
      newKpiConfig = [...selectedKpis, newKpi];
    } else {
      // Remove the KPI card from the list
      newKpiConfig = selectedKpis.filter(kpi => kpi.metric !== metric);
    }
    onChange(newKpiConfig);
  };

  return (
    <div className="space-y-2">
      {availableMetrics.length > 0 ? (
        availableMetrics.map(metric => (
          <label key={metric} className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={selectedMetrics.includes(metric)}
              onChange={(e) => handleToggle(metric, e.target.checked)}
              className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600"
            />
            <span className="ml-2 text-gray-200">{metric.replace(/_/g, ' ')}</span>
          </label>
        ))
      ) : (
        <p className="text-xs text-gray-400">Select metrics in the 'Metrics' section above to make them available as KPIs.</p>
      )}
    </div>
  );
}
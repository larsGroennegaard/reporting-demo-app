// app/components/DynamicConfigPanel.tsx
"use client";

import React from 'react';
import { MultiSelectFilter } from './MultiSelectFilter';
import MetricGroupControl from './MetricGroupControl';
import KpiSelector from './KpiSelector';
import ChartAndTableSettings from './ChartAndTableSettings';

const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

export default function DynamicConfigPanel({
  config,
  section,
  reportState,
  onStateChange,
  onMetricChange,
  dynamicOptions,
  availableKpiMetrics,
}: {
  config: any[],
  section: string,
  reportState: any,
  onStateChange: (key: string, value: any) => void,
  onMetricChange: (path: string, value: string, isChecked: boolean) => void,
  dynamicOptions: { [key: string]: any },
  availableKpiMetrics?: string[],
}) {
  
  const segmentationOptions = reportState.reportArchetype === 'outcome_analysis' 
    ? [{value: 'companyCountry', label: 'Company Country'}, {value: 'numberOfEmployees', label: 'Number of Employees'}]
    : [{value: 'channel', label: 'Channel'}, {value: 'companyCountry', label: 'Company Country'}, {value: 'numberOfEmployees', label: 'Number of Employees'}];

  const controlsForSection = config.filter(c => c.section === section);

  return (
    <div className="space-y-6">
      {controlsForSection.map((control) => {
        const { id, label, type, options, placeholder, optionsSource } = control;

        switch (type) {
          case 'radio':
            return (
              <div key={id}>
                <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                <div className="flex gap-4">
                  {options.map((opt: any) => (
                    <label key={opt.value} className="flex items-center text-sm">
                      <input
                        type="radio"
                        checked={getNestedValue(reportState.dataConfig, id) === opt.value}
                        onChange={(e) => onStateChange(`dataConfig.${id}`, e.target.value)}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <span className="ml-2">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          
          case 'select':
             return (
              <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                <select
                  id={id}
                  value={getNestedValue(reportState.dataConfig, id) || ''}
                  onChange={(e) => onStateChange(`dataConfig.${id}`, e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white rounded-md"
                >
                  {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );

          case 'multiselect':
            return (
                <div key={id}>
                    <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                    <MultiSelectFilter
                        options={dynamicOptions[optionsSource] || []}
                        selected={getNestedValue(reportState.dataConfig, id) || []}
                        onChange={(value) => onStateChange(`dataConfig.${id}`, value)}
                        placeholder={placeholder}
                    />
                </div>
            );
            
          case 'metric-group':
            return (
                <div key={id}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                    <MetricGroupControl
                        reportArchetype={reportState.reportArchetype!}
                        metrics={reportState.dataConfig.metrics || {}}
                        onMetricChange={onMetricChange}
                        stageOptions={dynamicOptions.stageOptions || []}
                    />
                </div>
            );
          
          case 'chart-table-settings':
            return (
                <div key={id}>
                    <ChartAndTableSettings
                        reportFocus={reportState.dataConfig.reportFocus}
                        onFocusChange={(value) => onStateChange('dataConfig.reportFocus', value)}
                        chartConfig={reportState.chart}
                        onChartChange={(value) => onStateChange('chart', value)}
                        tableConfig={reportState.table}
                        onTableChange={(value) => onStateChange('table', value)}
                        availableMetrics={reportState.kpiCards.map((kpi: any) => kpi.metric)}
                        segmentationOptions={segmentationOptions}
                    />
                </div>
            )

          default:
            return null;
        }
      })}
    </div>
  );
}
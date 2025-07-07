// app/components/ChartAndTableSettings.tsx
"use client";

import React from 'react';

export default function ChartAndTableSettings({
  reportFocus,
  onFocusChange,
  chartConfig,
  onChartChange,
  tableConfig,
  onTableChange,
  availableMetrics,
  segmentationOptions
}: {
  reportFocus: string;
  onFocusChange: (newFocus: string) => void;
  chartConfig: any;
  onChartChange: (newConfig: any) => void;
  tableConfig: any;
  onTableChange: (newConfig: any) => void;
  availableMetrics: string[];
  segmentationOptions: { value: string; label: string }[];
}) {

  const handleChartVariantChange = (variant: string) => {
    const newChartConfig = { ...chartConfig, variant, metrics: [] };
    
    // If we are switching to a single-metric view, pre-select the first available metric
    if (variant === 'time_series_segmented' && availableMetrics.length > 0) {
        newChartConfig.metric = availableMetrics[0];
    }

    onChartChange(newChartConfig);

    // Also update table variant to match
    let tableVariant = 'time_series_by_metric';
    if (variant === 'time_series_segmented') tableVariant = 'time_series_by_segment';
    if (variant === 'segmentation_bar') tableVariant = 'segmentation_by_metric';
    onTableChange({ ...tableConfig, variant: tableVariant });
  };

  const handleMetricSelection = (metric: string, isMulti: boolean) => {
    if (isMulti) {
        const currentMetrics = chartConfig.metrics || [];
        const newMetrics = currentMetrics.includes(metric)
            ? currentMetrics.filter((m: string) => m !== metric)
            : [...currentMetrics, metric];
        onChartChange({ ...chartConfig, metrics: newMetrics });
    } else {
        onChartChange({ ...chartConfig, metric: metric });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Focus</label>
        <div className="flex gap-4">
          <label className="flex items-center text-sm">
            <input type="radio" value="time_series" checked={reportFocus === 'time_series'} onChange={(e) => onFocusChange(e.target.value)} className="h-4 w-4 text-indigo-600"/>
            <span className="ml-2">Time Series</span>
          </label>
           <label className="flex items-center text-sm">
            <input type="radio" value="segmentation" checked={reportFocus === 'segmentation'} onChange={(e) => onFocusChange(e.target.value)} className="h-4 w-4 text-indigo-600"/>
            <span className="ml-2">Segmentation</span>
          </label>
        </div>
      </div>
      
      {reportFocus === 'time_series' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Chart Type</label>
           <select 
             value={chartConfig.variant} 
             onChange={(e) => handleChartVariantChange(e.target.value)}
             className="block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
            <option value="time_series_line">Multi-Metric Line Chart</option>
            <option value="time_series_segmented">Single Metric by Segment</option>
          </select>
        </div>
      )}

      {chartConfig.variant === 'time_series_segmented' && (
         <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Metric</label>
             <select value={chartConfig.metric || ''} onChange={(e) => handleMetricSelection(e.target.value, false)}  className="block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" disabled={availableMetrics.length === 0}>
                {availableMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </select>
        </div>
      )}

       {(chartConfig.variant === 'time_series_line' || reportFocus === 'segmentation') && (
         <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Metrics</label>
            <div className="space-y-1">
                 {availableMetrics.map(m => (
                    <label key={m} className="flex items-center text-sm">
                        <input type="checkbox" checked={chartConfig.metrics?.includes(m) || false} onChange={() => handleMetricSelection(m, true)} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600"/>
                        <span className="ml-2">{m.replace(/_/g, ' ')}</span>
                    </label>
                 ))}
            </div>
        </div>
      )}

       {reportFocus === 'segmentation' || chartConfig.variant === 'time_series_segmented' ? (
         <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Breakdown by</label>
             <select value={chartConfig.breakdown || ''} onChange={(e) => onChartChange({ ...chartConfig, breakdown: e.target.value })} className="block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                {segmentationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
       ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Chart Title</label>
        <input type="text" value={chartConfig.title} onChange={(e) => onChartChange({ ...chartConfig, title: e.target.value })} className="mt-1 block w-full bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md p-2"/>
      </div>
       <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Table Title</label>
        <input type="text" value={tableConfig.title} onChange={(e) => onTableChange({ ...tableConfig, title: e.target.value })} className="mt-1 block w-full bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md p-2"/>
      </div>
    </div>
  );
}
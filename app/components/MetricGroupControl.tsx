// app/components/MetricGroupControl.tsx
"use client";

import React from 'react';

// A helper function to safely get and set nested state properties
const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

export default function MetricGroupControl({
  reportArchetype,
  metrics,
  onMetricChange,
  stageOptions
}: {
  reportArchetype: 'outcome_analysis' | 'engagement_analysis',
  metrics: any,
  onMetricChange: (path: string, value: any, isChecked: boolean) => void,
  stageOptions: string[]
}) {

  if (reportArchetype === 'outcome_analysis') {
    return (
      <div className="space-y-4">
        {stageOptions.map(stage => (
          <div key={stage}>
            <p className="font-medium text-white">{stage}</p>
            <div className="pl-4 mt-1 space-y-1">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={getNestedValue(metrics, stage)?.includes('deals') || false}
                  onChange={(e) => onMetricChange(stage, 'deals', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600"
                />
                <span className="ml-2 text-gray-200"># Deals</span>
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={getNestedValue(metrics, stage)?.includes('value') || false}
                  onChange={(e) => onMetricChange(stage, 'value', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600"
                />
                <span className="ml-2 text-gray-200">Value</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // engagement_analysis
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-white">Base Metrics</p>
        <div className="pl-4 mt-1 space-y-1">
          {['companies', 'contacts', 'events', 'sessions'].map(metric => (
            <label key={metric} className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={metrics.base?.includes(metric) || false}
                onChange={(e) => onMetricChange('base', metric, e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600"
              />
              <span className="ml-2 text-gray-200 capitalize">{metric}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium text-white">Funnel Metrics</p>
        {stageOptions.map(stage => (
            <div key={stage} className="pl-4 mt-2">
                <p className="font-medium text-gray-300">{stage}</p>
                <div className="pl-4 mt-1 space-y-1">
                    <label className="flex items-center text-sm">
                        <input type="checkbox" checked={metrics.influenced?.[stage]?.includes('deals') || false} onChange={(e) => onMetricChange(`influenced.${stage}`, 'deals', e.target.checked)} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600" />
                        <span className="ml-2"># Touched Deals</span>
                    </label>
                    <label className="flex items-center text-sm">
                        <input type="checkbox" checked={metrics.attributed?.[stage]?.includes('deals') || false} onChange={(e) => onMetricChange(`attributed.${stage}`, 'deals', e.target.checked)} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600" />
                        <span className="ml-2"># Attributed Deals</span>
                    </label>
                    <label className="flex items-center text-sm">
                        <input type="checkbox" checked={metrics.influenced?.[stage]?.includes('value') || false} onChange={(e) => onMetricChange(`influenced.${stage}`, 'value', e.target.checked)} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600" />
                        <span className="ml-2">Touched Value</span>
                    </label>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
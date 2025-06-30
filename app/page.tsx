// app/page.tsx
"use client"; 

import { useState, useEffect, useMemo } from 'react';
import KpiCard from './components/KpiCard';
import Chart from './components/Chart';
import Table from './components/Table';
import { MultiSelectFilter, OptionType } from './components/MultiSelectFilter';

// --- State Shape Interfaces ---
interface KpiCardConfig { id: number; metric: string; }

interface OutcomeState {
  reportFocus: string;
  timePeriod: string;
  metrics: { [stageName: string]: ('deals' | 'value')[] };
  filters: {
    countries: string[];
    employeeSizes: string[];
  };
  chartSettings: {
    chartMode: string;
    singleChartMetric: string;
    multiChartMetrics: string[];
    segmentationProperty: string;
  };
  kpiCardConfig: KpiCardConfig[];
}

interface EngagementState {
  reportFocus: string;
  timePeriod: string;
  metrics: {
    base: string[];
    influenced: { [stageName: string]: ('deals' | 'value')[] };
  };
  filters: {
    eventNames: string[];
    signals: string[];
    url: string;
  };
  chartSettings: {
    chartMode: string;
    singleChartMetric: string;
    multiChartMetrics: string[];
    segmentationProperty: string;
  };
  kpiCardConfig: KpiCardConfig[];
}


export default function HomePage() {
  // --- Primary State ---
  const [reportArchetype, setReportArchetype] = useState('outcome_analysis'); 
  
  // --- Independent State Objects for Each Report ---
  const [outcomeState, setOutcomeState] = useState<OutcomeState>({
    reportFocus: 'time_series',
    timePeriod: 'this_year',
    metrics: { 'NewBiz': ['deals', 'value'], 'SQL': ['deals'] },
    filters: { countries: [], employeeSizes: [] },
    chartSettings: {
      chartMode: 'single_segmented',
      singleChartMetric: 'NewBiz_value',
      multiChartMetrics: ['NewBiz_value', 'SQL_deals'],
      segmentationProperty: 'companyCountry',
    },
    kpiCardConfig: [
      { id: 1, metric: 'NewBiz_deals' }, { id: 2, metric: 'NewBiz_value' }, { id: 3, metric: 'SQL_deals' },
    ],
  });

  const [engagementState, setEngagementState] = useState<EngagementState>({
    reportFocus: 'time_series',
    timePeriod: 'this_year',
    metrics: { base: ['companies', 'contacts', 'events'], influenced: {} },
    filters: { eventNames: [], signals: [], url: '' },
    chartSettings: {
      chartMode: 'single_segmented',
      singleChartMetric: 'companies',
      multiChartMetrics: ['companies', 'contacts'],
      segmentationProperty: 'companyCountry',
    },
    kpiCardConfig: [],
  });
  
  // UI and Data Fetching State
  const [isMetricsOpen, setIsMetricsOpen] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isChartTableSettingsOpen, setIsChartTableSettingsOpen] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dropdown options
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<OptionType[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<OptionType[]>([]);
  const [eventNameOptions, setEventNameOptions] = useState<OptionType[]>([]);
  const [signalOptions, setSignalOptions] = useState<OptionType[]>([]);

  // --- DERIVED STATE ---
  const currentReportState = reportArchetype === 'outcome_analysis' ? outcomeState : engagementState;
  
  const availableMetrics = useMemo(() => {
    if (reportArchetype === 'outcome_analysis') {
      return Object.entries(outcomeState.metrics).flatMap(([stage, types]) => 
        types.map(type => `${stage}_${type}`)
      ).sort();
    }
    // Engagement Analysis
    const baseMetrics = engagementState.metrics.base;
    const influenced = Object.entries(engagementState.metrics.influenced).flatMap(([stage, types]) => 
      types.map(type => `influenced_${stage}_${type}`)
    );
    return [...baseMetrics, ...influenced].sort();
  }, [reportArchetype, outcomeState.metrics, engagementState.metrics]);

  const currentConfig = useMemo(() => {
    const { metrics, ...rest } = currentReportState;
    if (reportArchetype === 'outcome_analysis') {
      return {
        reportArchetype,
        selectedMetrics: metrics,
        ...rest
      };
    }
    return {
      reportArchetype,
      metrics,
      ...rest
    };
  }, [reportArchetype, currentReportState]);

  // --- HOOKS ---
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const response = await fetch('/api/config-options', { headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }});
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setStageOptions(data.outcomes || []);
        setCountryOptions((data.countries || []).map((c: string) => ({ value: c, label: c })));
        setEmployeeOptions((data.employeeBuckets || []).map((e: string) => ({ value: e, label: e })));
        setEventNameOptions((data.eventNames || []).map((e: string) => ({ value: e, label: e })));
        setSignalOptions((data.signalNames || []).map((s: string) => ({ value: s, label: s })));
      } catch (error) { console.error("Failed to fetch dropdown options:", error); }
    };
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if(availableMetrics.length === 0 && currentReportState.kpiCardConfig.length === 0 && reportArchetype === 'outcome_analysis') {
        setIsLoading(false); setKpiData({}); setChartData([]); return;
      }
      setIsLoading(true);
      try {
        const response = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }, body: JSON.stringify(currentConfig) });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setKpiData(data.kpiData);
        setChartData(data.chartData);
      } catch (error) { console.error("Failed to fetch report data:", error); setKpiData(null); setChartData([]); }
      setIsLoading(false);
    };
    
    const handler = setTimeout(() => { fetchData(); }, 500);
    return () => { clearTimeout(handler); };
  }, [JSON.stringify(currentConfig)]);

  // --- UNIVERSAL HANDLER ---
  const handleStateChange = (path: string, value: any) => {
    const setState = reportArchetype === 'outcome_analysis' ? setOutcomeState : setEngagementState;
    
    setState((prev: OutcomeState | EngagementState) => {
      const keys = path.split('.');
      const newState = JSON.parse(JSON.stringify(prev));
      let current: any = newState;

      for(let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newState;
    });
  };

  const handleMetricCheckboxChange = (path: string, value: string, isChecked: boolean) => {
    const setState = reportArchetype === 'outcome_analysis' ? setOutcomeState : setEngagementState;
    
    setState((prev: OutcomeState | EngagementState) => {
      const keys = path.split('.');
      const newState = JSON.parse(JSON.stringify(prev));
      let current: any = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      let metricGroup = keys[keys.length - 1];
      const metricArray = current[metricGroup] || [];

      if (isChecked) {
        current[metricGroup] = [...metricArray, value];
      } else {
        current[metricGroup] = metricArray.filter((v: string) => v !== value);
      }
      return newState;
    });
  }

  const addKpiCard = () => {
    if (availableMetrics.length > 0) {
      const newCard = { id: Date.now(), metric: availableMetrics[0] };
      handleStateChange('kpiCardConfig', [...currentReportState.kpiCardConfig, newCard]);
    }
  };
  
  const removeKpiCard = (idToRemove: number) => {
    const newConfig = currentReportState.kpiCardConfig.filter(card => card.id !== idToRemove);
    handleStateChange('kpiCardConfig', newConfig);
  };
  
  const updateKpiCardMetric = (idToUpdate: number, newMetric: string) => {
    const newConfig = currentReportState.kpiCardConfig.map(card => 
      card.id === idToUpdate ? { ...card, metric: newMetric } : card
    );
    handleStateChange('kpiCardConfig', newConfig);
  };

  // --- RENDER FUNCTIONS FOR CONFIG PANELS ---
  const renderConfigPanels = () => {
    const isOutcome = reportArchetype === 'outcome_analysis';

    const metricPanel = isOutcome ? (
      <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">{stageOptions.map(stage => (<div key={stage}><p className="font-medium text-white">{stage}</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={outcomeState.metrics[stage]?.includes('deals')} onChange={(e) => handleMetricCheckboxChange(`metrics.${stage}`, 'deals', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Deals</span></label><label className="flex items-center"><input type="checkbox" checked={outcomeState.metrics[stage]?.includes('value')} onChange={(e) => handleMetricCheckboxChange(`metrics.${stage}`, 'value', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Value</span></label></div></div>))}</div>
    ) : (
      <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">
        <div><p className="font-medium text-white">Base Metrics</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={engagementState.metrics.base.includes('companies')} onChange={(e) => handleMetricCheckboxChange('metrics.base', 'companies', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Companies</span></label><label className="flex items-center"><input type="checkbox" checked={engagementState.metrics.base.includes('contacts')} onChange={(e) => handleMetricCheckboxChange('metrics.base', 'contacts', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Contacts</span></label><label className="flex items-center"><input type="checkbox" checked={engagementState.metrics.base.includes('events')} onChange={(e) => handleMetricCheckboxChange('metrics.base', 'events', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Events</span></label></div></div>
        <div><p className="font-medium text-white">Influenced Stage Metrics</p>{stageOptions.map(stage => (<div key={stage} className="pl-2 mt-1"><p className="font-medium text-gray-300">{stage}</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={engagementState.metrics.influenced[stage]?.includes('deals')} onChange={(e) => handleMetricCheckboxChange(`metrics.influenced.${stage}`, 'deals', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Touched Deals</span></label><label className="flex items-center"><input type="checkbox" checked={engagementState.metrics.influenced[stage]?.includes('value')} onChange={(e) => handleMetricCheckboxChange(`metrics.influenced.${stage}`, 'value', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Touched Value</span></label></div></div>))}</div>
      </div>
    );

    const filterPanel = isOutcome ? (
      <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2"><div><label className="block text-sm font-medium text-gray-400 mb-1">Company Country</label><MultiSelectFilter options={countryOptions} selected={outcomeState.filters.countries} onChange={(v) => handleStateChange('filters.countries', v)} placeholder="Select countries..."/></div><div><label className="block text-sm font-medium text-gray-400 mb-1">Number of Employees</label><MultiSelectFilter options={employeeOptions} selected={outcomeState.filters.employeeSizes} onChange={(v) => handleStateChange('filters.employeeSizes', v)} placeholder="Select sizes..."/></div></div>
    ) : (
      <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">
        <div><label className="block text-sm font-medium text-gray-400 mb-1">Event Name</label><MultiSelectFilter options={eventNameOptions} selected={engagementState.filters.eventNames} onChange={(v) => handleStateChange('filters.eventNames', v)} placeholder="Select events..."/></div>
        <div><label className="block text-sm font-medium text-gray-400 mb-1">Signal</label><MultiSelectFilter options={signalOptions} selected={engagementState.filters.signals} onChange={(v) => handleStateChange('filters.signals', v)} placeholder="Select signals..."/></div>
        <div><label htmlFor="urlFilter" className="block text-sm font-medium text-gray-400">URL Contains</label><input type="text" id="urlFilter" value={engagementState.filters.url} onChange={(e) => handleStateChange('filters.url', e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md p-2"/></div>
      </div>
    );

    return (
        <>
            <div><h3 className="text-lg font-semibold mb-2 text-gray-100">Report Focus</h3><fieldset className="flex gap-4"><label className="flex items-center"><input type="radio" name="reportFocus" value="time_series" checked={currentReportState.reportFocus === 'time_series'} onChange={(e) => handleStateChange('reportFocus', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Time Series</span></label><label className="flex items-center"><input type="radio" name="reportFocus" value="segmentation" checked={currentReportState.reportFocus === 'segmentation'} onChange={(e) => handleStateChange('reportFocus', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Segmentation</span></label></fieldset></div>
            <div><button onClick={() => setIsMetricsOpen(!isMetricsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Metrics</span><span className="text-xs">{isMetricsOpen ? '▼' : '►'}</span></button>{isMetricsOpen && metricPanel}</div>
            <div><button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Filters</span><span className="text-xs">{isFiltersOpen ? '▼' : '►'}</span></button>{isFiltersOpen && filterPanel}</div>
            <div><button onClick={() => setIsChartTableSettingsOpen(!isChartTableSettingsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Chart & Table Settings</span><span className="text-xs">{isChartTableSettingsOpen ? '▼' : '►'}</span></button>{isChartTableSettingsOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">{currentReportState.reportFocus === 'time_series' ? (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Time Series Chart</h3><fieldset className="space-y-2"><legend className="text-sm font-medium text-gray-400">Chart Mode</legend><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="chartMode" value="single_segmented" checked={currentReportState.chartSettings.chartMode === 'single_segmented'} onChange={(e) => handleStateChange('chartSettings.chartMode', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Breakdown</span></label><label className="flex items-center"><input type="radio" name="chartMode" value="multi_metric" checked={currentReportState.chartSettings.chartMode === 'multi_metric'} onChange={(e) => handleStateChange('chartSettings.chartMode', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Multiple Metrics</span></label></div></fieldset>{currentReportState.chartSettings.chartMode === 'single_segmented' && (<div className="mt-4 space-y-4"><div><label htmlFor="chartMetric" className="block text-sm font-medium text-gray-400">Metric</label><select id="chartMetric" value={currentReportState.chartSettings.singleChartMetric} onChange={(e) => handleStateChange('chartSettings.singleChartMetric', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" disabled={availableMetrics.length === 0}>{availableMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</select></div><div><label htmlFor="segmentationProperty" className="block text-sm font-medium text-gray-400">Breakdown by</label><select id="segmentationProperty" value={currentReportState.chartSettings.segmentationProperty} onChange={(e) => handleStateChange('chartSettings.segmentationProperty', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="companyCountry">Company Country</option><option value="numberOfEmployees">Number of Employees</option></select></div></div>)}{currentReportState.chartSettings.chartMode === 'multi_metric' && (<div className="mt-4 space-y-2">{availableMetrics.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" checked={currentReportState.chartSettings.multiChartMetrics.includes(metric)} onChange={() => handleStateChange('chartSettings.multiChartMetrics', currentReportState.chartSettings.multiChartMetrics.includes(metric) ? currentReportState.chartSettings.multiChartMetrics.filter(m => m !== metric) : [...currentReportState.chartSettings.multiChartMetrics, metric])} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div>)}</div>) : (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Segmentation Chart & Table</h3><div className="space-y-4"><div><label htmlFor="segmentationProperty" className="block text-sm font-medium text-gray-400">Breakdown by</label><select id="segmentationProperty" value={currentReportState.chartSettings.segmentationProperty} onChange={(e) => handleStateChange('chartSettings.segmentationProperty', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="companyCountry">Company Country</option><option value="numberOfEmployees">Number of Employees</option></select></div><div><label className="block text-sm font-medium text-gray-400">Metrics to Display</label><div className="mt-2 space-y-2">{availableMetrics.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" checked={currentReportState.chartSettings.multiChartMetrics.includes(metric)} onChange={() => handleStateChange('chartSettings.multiChartMetrics', currentReportState.chartSettings.multiChartMetrics.includes(metric) ? currentReportState.chartSettings.multiChartMetrics.filter(m => m !== metric) : [...currentReportState.chartSettings.multiChartMetrics, metric])} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div></div></div></div>)}</div>}</div>
            <div><label htmlFor="timePeriod" className="block text-sm font-medium text-gray-400">Time Period</label><select id="timePeriod" value={currentReportState.timePeriod} onChange={(e) => handleStateChange('timePeriod', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="this_year">This Year</option><option value="last_quarter">Last Quarter</option><option value="last_month">Last Month</option></select></div>
        </>
    );
  }

  // --- MAIN RENDER ---
  return (
    <main className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      <div className="w-1/3 max-w-sm p-6 bg-gray-800 shadow-lg overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-white">Report Configuration</h2>
        <div className="space-y-6">
          <div><h3 className="text-lg font-semibold mb-2 text-gray-100">Report Type</h3><fieldset className="flex gap-4"><label className="flex items-center"><input type="radio" name="reportArchetype" value="outcome_analysis" checked={reportArchetype === 'outcome_analysis'} onChange={(e) => setReportArchetype(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300" /><span className="ml-2">Outcome Analysis</span></label><label className="flex items-center"><input type="radio" name="reportArchetype" value="engagement_analysis" checked={reportArchetype === 'engagement_analysis'} onChange={(e) => setReportArchetype(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300" /><span className="ml-2">Engagement Analysis</span></label></fieldset></div>
          {renderConfigPanels()}
        </div>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">Your Report</h1>
        <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentReportState.kpiCardConfig.map(card => (
                    <div key={card.id} className="bg-gray-800/50 p-2 rounded-lg border border-gray-700">
                        <div className="flex justify-end mb-1"><button onClick={() => removeKpiCard(card.id)} className="text-gray-500 hover:text-red-400 text-xs">✖</button></div>
                        <select value={card.metric} onChange={(e) => updateKpiCardMetric(card.id, e.target.value)} className="mb-2 block w-full text-xs bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md" disabled={availableMetrics.length === 0}>
                            {availableMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                        </select>
                        <KpiCard title={(card.metric || '').replace(/_/g, ' ')} value={isLoading ? '...' : (kpiData ? kpiData[card.metric] : "-")} />
                    </div>
                ))}
            </div>
            <button onClick={addKpiCard} className="mt-4 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500" disabled={availableMetrics.length === 0}>+ Add KPI Card</button>
        </div>
        <div className="space-y-8">
            <Chart data={chartData} mode={currentReportState.reportFocus === 'segmentation' ? 'bar' : 'line'} config={currentConfig} />
            <Table data={chartData} mode={currentReportState.reportFocus} config={currentConfig} />
        </div>
        <div className="mt-8 bg-gray-800 p-4 shadow rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Current Configuration State</h3>
            <pre className="text-sm text-yellow-300 bg-gray-900 p-4 rounded-md overflow-x-auto">{JSON.stringify(currentConfig, null, 2)}</pre>
        </div>
      </div>
    </main>
  );
}
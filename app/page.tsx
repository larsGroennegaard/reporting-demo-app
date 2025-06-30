// app/page.tsx
"use client"; 

import { useState, useEffect, useMemo } from 'react';
import KpiCard from './components/KpiCard';
import Chart from './components/Chart';
import Table from './components/Table';
import { MultiSelectFilter, OptionType } from './components/MultiSelectFilter';

// Interface definitions
interface SelectedMetrics { [stageName: string]: ('deals' | 'value')[]; }
interface KpiCardConfig { id: number; metric: string; }

export default function HomePage() {
  // Global report settings
  const [reportArchetype, setReportArchetype] = useState('outcome_analysis'); 
  const [reportFocus, setReportFocus] = useState('time_series');
  const [timePeriod, setTimePeriod] = useState('this_year');

  // State for Outcome Analysis
  const [outcomeMetrics, setOutcomeMetrics] = useState<SelectedMetrics>({ 'NewBiz': ['deals', 'value'], 'SQL': ['deals'] });
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedEmployeeSizes, setSelectedEmployeeSizes] = useState<string[]>([]);

  // State for Engagement Analysis
  const [engagementMetrics, setEngagementMetrics] = useState<string[]>(['companies', 'contacts', 'events']);
  const [influencedMetrics, setInfluencedMetrics] = useState<SelectedMetrics>({});
  const [selectedEventNames, setSelectedEventNames] = useState<string[]>([]);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [urlFilter, setUrlFilter] = useState('');

  // Shared State
  const [kpiCardConfig, setKpiCardConfig] = useState<KpiCardConfig[]>([]);
  const [chartMode, setChartMode] = useState('single_segmented');
  const [singleChartMetric, setSingleChartMetric] = useState('');
  const [multiChartMetrics, setMultiChartMetrics] = useState<string[]>([]);
  const [segmentationProperty, setSegmentationProperty] = useState('companyCountry');
  
  // UI State
  const [isMetricsOpen, setIsMetricsOpen] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isChartTableSettingsOpen, setIsChartTableSettingsOpen] = useState(true);

  // Data & Loading
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
  const availableMetrics = useMemo(() => {
    let metrics: string[] = [];
    if (reportArchetype === 'outcome_analysis') {
      metrics = Object.entries(outcomeMetrics).flatMap(([stage, types]) => 
        types.map(type => `${stage}_${type}`)
      );
    } else if (reportArchetype === 'engagement_analysis') {
      const baseMetrics = engagementMetrics;
      const influenced = Object.entries(influencedMetrics).flatMap(([stage, types]) => 
        types.map(type => `influenced_${stage}_${type}`)
      );
      metrics = [...baseMetrics, ...influenced];
    }
    return metrics.sort();
  }, [reportArchetype, outcomeMetrics, engagementMetrics, influencedMetrics]);

  // --- CLEANED UP CONFIGURATION OBJECTS ---
  
const outcomeConfig = useMemo(() => ({
    reportArchetype: 'outcome_analysis',
    reportFocus,
    timePeriod,
    kpiCardConfig,
    chartMode,
    singleChartMetric,
    multiChartMetrics,
    segmentationProperty,
    selectedMetrics: outcomeMetrics,
    // --- FIX: Filters are now at the top-level, as the API expects ---
    selectedCountries: selectedCountries,
    selectedEmployeeSizes: selectedEmployeeSizes,
  }), [reportFocus, timePeriod, kpiCardConfig, chartMode, singleChartMetric, multiChartMetrics, segmentationProperty, outcomeMetrics, selectedCountries, selectedEmployeeSizes]);



  const engagementConfig = useMemo(() => ({
      reportArchetype: 'engagement_analysis',
      reportFocus,
      timePeriod,
      kpiCardConfig,
      chartMode,
      singleChartMetric,
      multiChartMetrics,
      segmentationProperty,
      metrics: {
          base: engagementMetrics,
          influenced: influencedMetrics,
      },
      filters: {
          eventNames: selectedEventNames,
          signals: selectedSignals,
          url: urlFilter,
      }
  }), [reportFocus, timePeriod, kpiCardConfig, chartMode, singleChartMetric, multiChartMetrics, segmentationProperty, engagementMetrics, influencedMetrics, selectedEventNames, selectedSignals, urlFilter]);
  
  const currentConfig = useMemo(() => (
    reportArchetype === 'outcome_analysis' ? outcomeConfig : engagementConfig
  ), [reportArchetype, outcomeConfig, engagementConfig]);

  // Dependency strings for main data fetching useEffect
  const kpiConfigDep = JSON.stringify(kpiCardConfig);
  const currentConfigDep = JSON.stringify(currentConfig);


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
    // Set initial state when switching archetypes or when available metrics change for the first time
    setIsLoading(true);
    setKpiData(null);
    setChartData([]);
    
    // Set defaults based on the selected archetype
    if (reportArchetype === 'outcome_analysis') {
      const defaultMetric = 'NewBiz_value';
      setSingleChartMetric(availableMetrics.includes(defaultMetric) ? defaultMetric : availableMetrics[0] || '');
      setMultiChartMetrics(['NewBiz_value', 'SQL_deals'].filter(m => availableMetrics.includes(m)));
      setKpiCardConfig([
        { id: 1, metric: 'NewBiz_deals' }, { id: 2, metric: 'NewBiz_value' }, { id: 3, metric: 'SQL_deals' },
      ].filter(c => availableMetrics.includes(c.metric)));
    } else {
      const defaultMetric = 'companies';
      setSingleChartMetric(availableMetrics.includes(defaultMetric) ? defaultMetric : availableMetrics[0] || '');
      setMultiChartMetrics(['companies', 'contacts'].filter(m => availableMetrics.includes(m)));
      setKpiCardConfig([]); // <-- Cards start empty for Engagement Analysis
    }
  }, [reportArchetype, availableMetrics.join(',')]);

  useEffect(() => {
    const fetchData = async () => {
      if(availableMetrics.length === 0) {
        setIsLoading(false);
        setKpiData({});
        setChartData([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }, body: currentConfigDep });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setKpiData(data.kpiData);
        setChartData(data.chartData);
      } catch (error) { console.error("Failed to fetch report data:", error); setKpiData(null); setChartData([]); }
      setIsLoading(false);
    };
    
    const handler = setTimeout(() => { fetchData(); }, 500);
    return () => { clearTimeout(handler); };

  }, [currentConfigDep]); // Main data fetching effect runs only when the final config changes

  // --- HANDLERS ---
  const handleOutcomeMetricChange = (stageName: string, metricType: 'deals' | 'value') => { setOutcomeMetrics(prev => { const newConfig = { ...prev }; const stageMetrics = newConfig[stageName] || []; if (stageMetrics.includes(metricType)) { newConfig[stageName] = stageMetrics.filter((m: string) => m !== metricType); if (newConfig[stageName].length === 0) { delete newConfig[stageName]; } } else { newConfig[stageName] = [...stageMetrics, metricType]; } return newConfig; }); };
  const handleEngagementMetricChange = (metric: string) => { setEngagementMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]); };
  const handleInfluencedMetricChange = (stageName: string, metricType: 'deals' | 'value') => { setInfluencedMetrics(prev => { const newConfig = { ...prev }; const stageMetrics = newConfig[stageName] || []; if (stageMetrics.includes(metricType)) { newConfig[stageName] = stageMetrics.filter((m: string) => m !== metricType); if (newConfig[stageName].length === 0) { delete newConfig[stageName]; } } else { newConfig[stageName] = [...stageMetrics, metricType]; } return newConfig; }); };
  const handleMultiChartMetricChange = (metric: string) => { setMultiChartMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]); };
  const addKpiCard = () => { if (availableMetrics.length > 0) setKpiCardConfig(prev => [...prev, { id: Date.now(), metric: availableMetrics[0] }]); };
  const removeKpiCard = (idToRemove: number) => { setKpiCardConfig(prev => prev.filter(card => card.id !== idToRemove)); };
  const updateKpiCardMetric = (idToUpdate: number, newMetric: string) => { setKpiCardConfig(prev => prev.map(card => card.id === idToUpdate ? { ...card, metric: newMetric } : card)); };


  // --- RENDER FUNCTIONS FOR CONFIG PANELS ---
  const renderConfigPanels = () => {
    const isOutcome = reportArchetype === 'outcome_analysis';
    const metricPanel = isOutcome ? (
        // Outcome Metrics Panel
        <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">{stageOptions.map(stage => (<div key={stage}><p className="font-medium text-white">{stage}</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={outcomeMetrics[stage]?.includes('deals')} onChange={() => handleOutcomeMetricChange(stage, 'deals')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Deals</span></label><label className="flex items-center"><input type="checkbox" checked={outcomeMetrics[stage]?.includes('value')} onChange={() => handleOutcomeMetricChange(stage, 'value')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Value</span></label></div></div>))}</div>
    ) : (
        // Engagement Metrics Panel
        <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">
            <div><p className="font-medium text-white">Base Metrics</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={engagementMetrics.includes('companies')} onChange={() => handleEngagementMetricChange('companies')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Companies</span></label><label className="flex items-center"><input type="checkbox" checked={engagementMetrics.includes('contacts')} onChange={() => handleEngagementMetricChange('contacts')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Contacts</span></label><label className="flex items-center"><input type="checkbox" checked={engagementMetrics.includes('events')} onChange={() => handleEngagementMetricChange('events')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Events</span></label></div></div>
            <div><p className="font-medium text-white">Influenced Stage Metrics</p>{stageOptions.map(stage => (<div key={stage} className="pl-2 mt-1"><p className="font-medium text-gray-300">{stage}</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={influencedMetrics[stage]?.includes('deals')} onChange={() => handleInfluencedMetricChange(stage, 'deals')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Touched Deals</span></label><label className="flex items-center"><input type="checkbox" checked={influencedMetrics[stage]?.includes('value')} onChange={() => handleInfluencedMetricChange(stage, 'value')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Touched Value</span></label></div></div>))}</div>
        </div>
    );

    const filterPanel = isOutcome ? (
        // Outcome Filters Panel
        <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2"><div><label className="block text-sm font-medium text-gray-400 mb-1">Company Country</label><MultiSelectFilter options={countryOptions} selected={selectedCountries} onChange={setSelectedCountries} placeholder="Select countries..."/></div><div><label className="block text-sm font-medium text-gray-400 mb-1">Number of Employees</label><MultiSelectFilter options={employeeOptions} selected={selectedEmployeeSizes} onChange={setSelectedEmployeeSizes} placeholder="Select sizes..."/></div></div>
    ) : (
        // Engagement Filters Panel
        <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">
            <div><label className="block text-sm font-medium text-gray-400 mb-1">Event Name</label><MultiSelectFilter options={eventNameOptions} selected={selectedEventNames} onChange={setSelectedEventNames} placeholder="Select events..."/></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1">Signal</label><MultiSelectFilter options={signalOptions} selected={selectedSignals} onChange={setSelectedSignals} placeholder="Select signals..."/></div>
            <div><label htmlFor="urlFilter" className="block text-sm font-medium text-gray-400">URL Contains</label><input type="text" id="urlFilter" value={urlFilter} onChange={(e) => setUrlFilter(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md p-2"/></div>
        </div>
    );

    return (
        <>
            <div><h3 className="text-lg font-semibold mb-2 text-gray-100">Report Focus</h3><fieldset className="flex gap-4"><label className="flex items-center"><input type="radio" name="reportFocus" value="time_series" checked={reportFocus === 'time_series'} onChange={(e) => setReportFocus(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Time Series</span></label><label className="flex items-center"><input type="radio" name="reportFocus" value="segmentation" checked={reportFocus === 'segmentation'} onChange={(e) => setReportFocus(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Segmentation</span></label></fieldset></div>
            <div><button onClick={() => setIsMetricsOpen(!isMetricsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Metrics</span><span className="text-xs">{isMetricsOpen ? '▼' : '►'}</span></button>{isMetricsOpen && metricPanel}</div>
            <div><button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Filters</span><span className="text-xs">{isFiltersOpen ? '▼' : '►'}</span></button>{isFiltersOpen && filterPanel}</div>
            <div><button onClick={() => setIsChartTableSettingsOpen(!isChartTableSettingsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Chart & Table Settings</span><span className="text-xs">{isChartTableSettingsOpen ? '▼' : '►'}</span></button>{isChartTableSettingsOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">{reportFocus === 'time_series' ? (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Time Series Chart</h3><fieldset className="space-y-2"><legend className="text-sm font-medium text-gray-400">Chart Mode</legend><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="chartMode" value="single_segmented" checked={chartMode === 'single_segmented'} onChange={(e) => setChartMode(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Breakdown</span></label><label className="flex items-center"><input type="radio" name="chartMode" value="multi_metric" checked={chartMode === 'multi_metric'} onChange={(e) => setChartMode(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Multiple Metrics</span></label></div></fieldset>{chartMode === 'single_segmented' && (<div className="mt-4 space-y-4"><div><label htmlFor="chartMetric" className="block text-sm font-medium text-gray-400">Metric</label><select id="chartMetric" value={singleChartMetric} onChange={(e) => setSingleChartMetric(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" disabled={availableMetrics.length === 0}>{availableMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</select></div><div><label htmlFor="segmentationProperty" className="block text-sm font-medium text-gray-400">Breakdown by</label><select id="segmentationProperty" value={segmentationProperty} onChange={(e) => setSegmentationProperty(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="companyCountry">Company Country</option><option value="numberOfEmployees">Number of Employees</option></select></div></div>)}{chartMode === 'multi_metric' && (<div className="mt-4 space-y-2">{availableMetrics.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" name={metric} checked={multiChartMetrics.includes(metric)} onChange={() => handleMultiChartMetricChange(metric)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div>)}</div>) : (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Segmentation Chart & Table</h3><div className="space-y-4"><div><label htmlFor="segmentationProperty" className="block text-sm font-medium text-gray-400">Breakdown by</label><select id="segmentationProperty" value={segmentationProperty} onChange={(e) => setSegmentationProperty(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="companyCountry">Company Country</option><option value="numberOfEmployees">Number of Employees</option></select></div><div><label className="block text-sm font-medium text-gray-400">Metrics to Display</label><div className="mt-2 space-y-2">{availableMetrics.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" name={metric} checked={multiChartMetrics.includes(metric)} onChange={() => handleMultiChartMetricChange(metric)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div></div></div></div>)}</div>}</div>
            <div><label htmlFor="timePeriod" className="block text-sm font-medium text-gray-400">Time Period</label><select id="timePeriod" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="this_year">This Year</option><option value="last_quarter">Last Quarter</option><option value="last_month">Last Month</option></select></div>
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
                {kpiCardConfig.map(card => (
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
            <Chart data={chartData} mode={reportFocus === 'segmentation' ? 'bar' : 'line'} config={currentConfig} />
            <Table data={chartData} mode={reportFocus} config={currentConfig} />
        </div>
        <div className="mt-8 bg-gray-800 p-4 shadow rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Current Configuration State</h3>
            <pre className="text-sm text-yellow-300 bg-gray-900 p-4 rounded-md overflow-x-auto">{JSON.stringify(currentConfig, null, 2)}</pre>
        </div>
      </div>
    </main>
  );
}
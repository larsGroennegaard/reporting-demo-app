// app/page.tsx
"use client"; 

import { useState, useEffect, useMemo } from 'react';
import KpiCard from './components/KpiCard';
import Chart from './components/Chart';
import Table from './components/Table';
import { MultiSelectFilter, OptionType } from './components/MultiSelectFilter';
import { X } from 'lucide-react';

// --- State Shape Interfaces ---
interface KpiCardConfig { id: number; metric: string; }

// A single, flat state object for the entire Outcome Analysis report configuration
interface ReportState {
  reportFocus: string;
  timePeriod: string;
  selectedMetrics: { [stageName: string]: ('deals' | 'value')[] };
  selectedCountries: string[];
  selectedEmployeeSizes: string[];
  chartMode: string;
  singleChartMetric: string;
  multiChartMetrics: string[];
  segmentationProperty: string;
  kpiCardConfig: KpiCardConfig[];
}

export default function HomePage() {
  // --- A Single State Object for the Report ---
  const [config, setConfig] = useState<ReportState>({
    reportFocus: 'time_series',
    timePeriod: 'this_year',
    selectedMetrics: { 'NewBiz': ['deals', 'value'], 'SQL': ['deals'] },
    selectedCountries: [],
    selectedEmployeeSizes: [],
    chartMode: 'single_segmented',
    singleChartMetric: 'NewBiz_value',
    multiChartMetrics: ['NewBiz_value', 'SQL_deals'],
    segmentationProperty: 'companyCountry',
    kpiCardConfig: [
      { id: 1, metric: 'NewBiz_deals' }, { id: 2, metric: 'NewBiz_value' }, { id: 3, metric: 'SQL_deals' },
    ],
  });
  
  // UI and Data Fetching State
  const [isMetricsOpen, setIsMetricsOpen] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isKpiConfigOpen, setIsKpiConfigOpen] = useState(true);
  const [isChartTableSettingsOpen, setIsChartTableSettingsOpen] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dropdown options
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<OptionType[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<OptionType[]>([]);

  // --- DERIVED STATE ---
  const availableMetrics = useMemo(() => {
    return Object.entries(config.selectedMetrics).flatMap(([stage, types]) => 
      types.map(type => `${stage}_${type}`)
    ).sort();
  }, [config.selectedMetrics]);

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
      } catch (error) { console.error("Failed to fetch dropdown options:", error); }
    };
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    // This effect now simply depends on the stringified config object
    const fetchData = async () => {
      if(availableMetrics.length === 0) {
        setIsLoading(false); setKpiData({}); setChartData([]); return;
      }
      setIsLoading(true);
      try {
        const response = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }, body: JSON.stringify({reportArchetype: 'outcome_analysis', ...config}) });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setKpiData(data.kpiData);
        setChartData(data.chartData);
      } catch (error) { console.error("Failed to fetch report data:", error); setKpiData(null); setChartData([]); }
      setIsLoading(false);
    };
    
    const handler = setTimeout(() => { fetchData(); }, 500);
    return () => { clearTimeout(handler); };
  }, [JSON.stringify(config)]);

  // --- DIRECT HANDLERS FOR CLEANER STATE UPDATES ---
  const handleConfigChange = (key: keyof ReportState, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleMetricChange = (stageName: string, metricType: 'deals' | 'value') => {
    const newMetrics = { ...config.selectedMetrics };
    const stageMetrics = newMetrics[stageName] || [];
    if (stageMetrics.includes(metricType)) {
      newMetrics[stageName] = stageMetrics.filter((m: string) => m !== metricType);
      if (newMetrics[stageName].length === 0) {
        delete newMetrics[stageName];
      }
    } else {
      newMetrics[stageName] = [...stageMetrics, metricType];
    }
    handleConfigChange('selectedMetrics', newMetrics);
  };
  
  const addKpiCard = () => {
    if (availableMetrics.length > 0) {
      const newCard = { id: Date.now(), metric: availableMetrics[0] };
      handleConfigChange('kpiCardConfig', [...config.kpiCardConfig, newCard]);
    }
  };
  
  const removeKpiCard = (idToRemove: number) => {
    const newKpiConfig = config.kpiCardConfig.filter(card => card.id !== idToRemove);
    handleConfigChange('kpiCardConfig', newKpiConfig);
  };
  
  const updateKpiCardMetric = (idToUpdate: number, newMetric: string) => {
    const newKpiConfig = config.kpiCardConfig.map(card => 
      card.id === idToUpdate ? { ...card, metric: newMetric } : card
    );
    handleConfigChange('kpiCardConfig', newKpiConfig);
  };

  return (
    <main className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      <div className="w-1/3 max-w-sm p-6 bg-gray-800 shadow-lg overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-white">Report Configuration</h2>
        <div className="space-y-6">
          {/* Panel: Report Focus */}
          <div><h3 className="text-lg font-semibold mb-2 text-gray-100">Report Focus</h3><fieldset className="flex gap-4"><label className="flex items-center"><input type="radio" name="reportFocus" value="time_series" checked={config.reportFocus === 'time_series'} onChange={(e) => handleConfigChange('reportFocus', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Time Series</span></label><label className="flex items-center"><input type="radio" name="reportFocus" value="segmentation" checked={config.reportFocus === 'segmentation'} onChange={(e) => handleConfigChange('reportFocus', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Segmentation</span></label></fieldset></div>
          
          {/* Panel: Metrics */}
          <div><button onClick={() => setIsMetricsOpen(!isMetricsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Metrics</span><span className="text-xs">{isMetricsOpen ? '▼' : '►'}</span></button>{isMetricsOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">{stageOptions.map(stage => (<div key={stage}><p className="font-medium text-white">{stage}</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={config.selectedMetrics[stage]?.includes('deals')} onChange={() => handleMetricChange(stage, 'deals')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Deals</span></label><label className="flex items-center"><input type="checkbox" checked={config.selectedMetrics[stage]?.includes('value')} onChange={() => handleMetricChange(stage, 'value')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Value</span></label></div></div>))}</div>}</div>

          {/* Panel: Filters */}
          <div><button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Filters</span><span className="text-xs">{isFiltersOpen ? '▼' : '►'}</span></button>{isFiltersOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2"><div><label className="block text-sm font-medium text-gray-400 mb-1">Time Period</label><select value={config.timePeriod} onChange={(e) => handleConfigChange('timePeriod', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="this_year">This Year</option><option value="last_quarter">Last Quarter</option><option value="last_month">Last Month</option></select></div><div><label className="block text-sm font-medium text-gray-400 mb-1">Company Country</label><MultiSelectFilter options={countryOptions} selected={config.selectedCountries} onChange={(v) => handleConfigChange('selectedCountries', v)} placeholder="Select countries..."/></div><div><label className="block text-sm font-medium text-gray-400 mb-1">Number of Employees</label><MultiSelectFilter options={employeeOptions} selected={config.selectedEmployeeSizes} onChange={(v) => handleConfigChange('selectedEmployeeSizes', v)} placeholder="Select sizes..."/></div></div>}</div>

          {/* Panel: KPI Card Configuration */}
          <div>
            <button onClick={() => setIsKpiConfigOpen(!isKpiConfigOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>KPI Card Configuration</span><span className="text-xs">{isKpiConfigOpen ? '▼' : '►'}</span></button>
            {isKpiConfigOpen && <div className="mt-2 space-y-2 border-l-2 border-gray-700 pl-4 pt-2">
                {config.kpiCardConfig.map((card, index) => (
                  <div key={card.id} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded-md">
                    <span className="text-sm font-medium text-gray-400">Card {index + 1}:</span>
                    <select value={card.metric} onChange={(e) => updateKpiCardMetric(card.id, e.target.value)} className="flex-1 block w-full text-xs bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md" disabled={availableMetrics.length === 0}>
                      {availableMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                    </select>
                    <button onClick={() => removeKpiCard(card.id)} className="p-1 text-gray-500 hover:text-red-400"><X size={16}/></button>
                  </div>
                ))}
                <button onClick={addKpiCard} className="mt-2 w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500" disabled={availableMetrics.length === 0}>+ Add KPI Card</button>
            </div>}
          </div>

          {/* Panel: Chart & Table Settings */}
          <div><button onClick={() => setIsChartTableSettingsOpen(!isChartTableSettingsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Chart & Table Settings</span><span className="text-xs">{isChartTableSettingsOpen ? '▼' : '►'}</span></button>{isChartTableSettingsOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">{config.reportFocus === 'time_series' ? (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Time Series Chart</h3><fieldset className="space-y-2"><legend className="text-sm font-medium text-gray-400">Chart Mode</legend><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="chartMode" value="single_segmented" checked={config.chartMode === 'single_segmented'} onChange={(e) => handleConfigChange('chartMode', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Breakdown</span></label><label className="flex items-center"><input type="radio" name="chartMode" value="multi_metric" checked={config.chartMode === 'multi_metric'} onChange={(e) => handleConfigChange('chartMode', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Multiple Metrics</span></label></div></fieldset>{config.chartMode === 'single_segmented' ? (<div className="mt-4 space-y-4"><div><label className="block text-sm font-medium text-gray-400">Metric</label><select value={config.singleChartMetric} onChange={(e) => handleConfigChange('singleChartMetric', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" disabled={availableMetrics.length === 0}>{availableMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</select></div><div><label className="block text-sm font-medium text-gray-400">Breakdown by</label><select value={config.segmentationProperty} onChange={(e) => handleConfigChange('segmentationProperty', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="companyCountry">Company Country</option><option value="numberOfEmployees">Number of Employees</option></select></div></div>) : (<div className="mt-4 space-y-2">{availableMetrics.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" checked={config.multiChartMetrics.includes(metric)} onChange={() => handleConfigChange('multiChartMetrics', config.multiChartMetrics.includes(metric) ? config.multiChartMetrics.filter(m => m !== metric) : [...config.multiChartMetrics, metric])} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div>)}</div>) : (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Segmentation Chart & Table</h3><div className="space-y-4"><div><label className="block text-sm font-medium text-gray-400">Breakdown by</label><select value={config.segmentationProperty} onChange={(e) => handleConfigChange('segmentationProperty', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="companyCountry">Company Country</option><option value="numberOfEmployees">Number of Employees</option></select></div><div><label className="block text-sm font-medium text-gray-400">Metrics to Display</label><div className="mt-2 space-y-2">{availableMetrics.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" checked={config.multiChartMetrics.includes(metric)} onChange={() => handleConfigChange('multiChartMetrics', config.multiChartMetrics.includes(metric) ? config.multiChartMetrics.filter(m => m !== metric) : [...config.multiChartMetrics, metric])} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div></div></div></div>)}</div>}</div>
        </div>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">Your Report</h1>
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {config.kpiCardConfig.map(card => (
              <KpiCard key={card.id} title={(card.metric || '').replace(/_/g, ' ')} value={isLoading ? '...' : (kpiData ? kpiData[card.metric] : "-")} />
            ))}
        </div>
        <div className="space-y-8">
            <Chart data={chartData} mode={config.reportFocus === 'segmentation' ? 'bar' : 'line'} config={config} />
            <Table data={chartData} mode={config.reportFocus} config={config} />
        </div>
        <div className="mt-8 bg-gray-800 p-4 shadow rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Current Configuration State</h3>
            <pre className="text-sm text-yellow-300 bg-gray-900 p-4 rounded-md overflow-x-auto">{JSON.stringify({reportArchetype: 'outcome_analysis', ...config}, null, 2)}</pre>
        </div>
      </div>
    </main>
  );
}
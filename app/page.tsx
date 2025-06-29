// app/page.tsx
"use client"; 

import { useState, useEffect, useMemo } from 'react';
import KpiCard from './components/KpiCard';
import Chart from './components/Chart';
import Table from './components/Table';
import { MultiSelectFilter, OptionType } from './components/MultiSelectFilter';

interface SelectedMetrics { [stageName: string]: ('deals' | 'value')[]; }
interface KpiCardConfig { id: number; metric: string; }

export default function HomePage() {
  const [reportFocus, setReportFocus] = useState('time_series');
  const [selectedMetrics, setSelectedMetrics] = useState<SelectedMetrics>({ 'NewBiz': ['deals', 'value'], 'SQL': ['deals'] });
  const [kpiCardConfig, setKpiCardConfig] = useState<KpiCardConfig[]>([
    { id: 1, metric: 'NewBiz_deals' }, { id: 2, metric: 'NewBiz_value' }, { id: 3, metric: 'SQL_deals' },
  ]);
  const [timePeriod, setTimePeriod] = useState('this_year');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedEmployeeSizes, setSelectedEmployeeSizes] = useState<string[]>([]);
  const [chartMode, setChartMode] = useState('single_segmented');
  const [singleChartMetric, setSingleChartMetric] = useState('NewBiz_value');
  const [segmentationProperty, setSegmentationProperty] = useState('companyCountry');
  const [multiChartMetrics, setMultiChartMetrics] = useState<string[]>(['NewBiz_value', 'SQL_deals']);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isChartTableSettingsOpen, setIsChartTableSettingsOpen] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<OptionType[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<OptionType[]>([]);

  const availableMetrics = useMemo(() => {
    return Object.entries(selectedMetrics).flatMap(([stage, types]) => 
      types.map(type => `${stage}_${type}`)
    ).sort();
  }, [selectedMetrics]);
  
  const selectedCountriesDep = selectedCountries.join(',');
  const selectedEmployeeSizesDep = selectedEmployeeSizes.join(',');
  const multiChartMetricsDep = multiChartMetrics.join(',');
  const kpiConfigDep = JSON.stringify(kpiCardConfig);
  const selectedMetricsDep = JSON.stringify(selectedMetrics);

  const currentConfig = { reportFocus, selectedMetrics, kpiCardConfig, timePeriod, selectedCountries, selectedEmployeeSizes, chartMode, singleChartMetric, segmentationProperty, multiChartMetrics };

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
    setMultiChartMetrics(prev => prev.filter(m => availableMetrics.includes(m)));
    if (!availableMetrics.includes(singleChartMetric)) { setSingleChartMetric(availableMetrics[0] || ''); }
  }, [availableMetrics]);

  useEffect(() => {
    if (Object.keys(selectedMetrics).length === 0) { setIsLoading(false); setKpiData({}); setChartData([]); return; };
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }, body: JSON.stringify(currentConfig), });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setKpiData(data.kpiData);
        setChartData(data.chartData);
      } catch (error) { console.error("Failed to fetch report data:", error); setKpiData(null); setChartData([]); }
      setIsLoading(false);
    };
    fetchData();
  }, [reportFocus, selectedMetricsDep, kpiConfigDep, timePeriod, selectedCountriesDep, selectedEmployeeSizesDep, chartMode, singleChartMetric, segmentationProperty, multiChartMetricsDep]);

  const handleMetricChange = (stageName: string, metricType: 'deals' | 'value') => { setSelectedMetrics(prev => { const newConfig = JSON.parse(JSON.stringify(prev)); const stageMetrics = newConfig[stageName] || []; if (stageMetrics.includes(metricType)) { newConfig[stageName] = stageMetrics.filter((m: string) => m !== metricType); if (newConfig[stageName].length === 0) { delete newConfig[stageName]; } } else { newConfig[stageName] = [...stageMetrics, metricType]; } return newConfig; }); };
  const addKpiCard = () => { setKpiCardConfig(prev => [...prev, { id: Date.now(), metric: availableMetrics[0] || '' }]); };
  const removeKpiCard = (idToRemove: number) => { setKpiCardConfig(prev => prev.filter(card => card.id !== idToRemove)); };
  const updateKpiCardMetric = (idToUpdate: number, newMetric: string) => { setKpiCardConfig(prev => prev.map(card => card.id === idToUpdate ? { ...card, metric: newMetric } : card)); };

  return (
    <main className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      <div className="w-1/3 max-w-sm p-6 bg-gray-800 shadow-lg overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-white">Report Configuration</h2>
        <div className="space-y-6">
            <div><h3 className="text-lg font-semibold mb-2 text-gray-100">Report Focus</h3><fieldset className="flex gap-4"><label className="flex items-center"><input type="radio" name="reportFocus" value="time_series" checked={reportFocus === 'time_series'} onChange={(e) => setReportFocus(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Time Series</span></label><label className="flex items-center"><input type="radio" name="reportFocus" value="segmentation" checked={reportFocus === 'segmentation'} onChange={(e) => setReportFocus(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Segmentation</span></label></fieldset></div>
            <div><button onClick={() => setIsMetricsOpen(!isMetricsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Metrics</span><span className="text-xs">{isMetricsOpen ? '▼' : '►'}</span></button>{isMetricsOpen && (<div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">{stageOptions.map(stage => (<div key={stage}><p className="font-medium text-white">{stage}</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={selectedMetrics[stage]?.includes('deals')} onChange={() => handleMetricChange(stage, 'deals')} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="ml-2"># Deals</span></label><label className="flex items-center"><input type="checkbox" checked={selectedMetrics[stage]?.includes('value')} onChange={() => handleMetricChange(stage, 'value')} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="ml-2">Value</span></label></div></div>))}</div>)}</div>
            <div><button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Filters</span><span className="text-xs">{isFiltersOpen ? '▼' : '►'}</span></button>{isFiltersOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2"><div><label htmlFor="timePeriod" className="block text-sm font-medium text-gray-400">Time Period</label><select id="timePeriod" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="this_year">This Year</option><option value="last_quarter">Last Quarter</option><option value="last_month">Last Month</option></select></div><div><label className="block text-sm font-medium text-gray-400 mb-1">Company Country</label><MultiSelectFilter options={countryOptions} selected={selectedCountries} onChange={setSelectedCountries} placeholder="Select countries..."/></div><div><label className="block text-sm font-medium text-gray-400 mb-1">Number of Employees</label><MultiSelectFilter options={employeeOptions} selected={selectedEmployeeSizes} onChange={setSelectedEmployeeSizes} placeholder="Select sizes..."/></div></div>}</div>
            <div><button onClick={() => setIsChartTableSettingsOpen(!isChartTableSettingsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Chart & Table Settings</span><span className="text-xs">{isChartTableSettingsOpen ? '▼' : '►'}</span></button>{isChartTableSettingsOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">{/* ... Chart/Table settings JSX ... */}</div>}</div>
        </div>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        {/* ... Right Panel JSX ... */}
      </div>
    </main>
  );
}
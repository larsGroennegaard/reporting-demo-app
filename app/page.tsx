// app/page.tsx
"use client"; 

import { useState, useEffect } from 'react';
import KpiCard from './components/KpiCard';
import Chart from './components/Chart';

export default function HomePage() {
  const [outcome, setOutcome] = useState('');
  const [timePeriod, setTimePeriod] = useState('this_year');
  const [companyCountry, setCompanyCountry] = useState('all');
  const [numberOfEmployees, setNumberOfEmployees] = useState('all');

  const [chartMode, setChartMode] = useState('single_segmented');
  const [chartMetric, setChartMetric] = useState('totalValue');
  const [segmentationProperty, setSegmentationProperty] = useState('companyCountry');
  const [multiMetrics, setMultiMetrics] = useState({
    totalValue: true,
    totalDeals: true,
    influencedValue: false,
  });

  const [kpiData, setKpiData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [outcomeOptions, setOutcomeOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const response = await fetch('/api/config-options');
        const data = await response.json();
        setOutcomeOptions(data.outcomes || []);
        setCountryOptions(data.countries || []);
        setEmployeeOptions(data.employeeBuckets || []);
        if (data.outcomes && data.outcomes.length > 0 && !outcome) {
            setOutcome(data.outcomes[0]);
        }
      } catch (error) { console.error("Failed to fetch dropdown options:", error); }
    };
    fetchDropdownOptions();
  }, []);

  const currentConfig = { outcome, timePeriod, companyCountry, numberOfEmployees, chartMode, chartMetric, segmentationProperty, multiMetrics };

  useEffect(() => {
    if (!outcome) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentConfig), // Send the whole config
        });
        const data = await response.json();
        setKpiData(data.kpiData);
        setChartData(data.chartData);
      } catch (error) {
        console.error("Failed to fetch report data:", error);
        setKpiData(null); setChartData([]);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [outcome, timePeriod, companyCountry, numberOfEmployees, chartMode, chartMetric, segmentationProperty, multiMetrics]); // Re-run when any config changes

  const handleMultiMetricChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setMultiMetrics(prev => ({ ...prev, [name]: checked }));
  };

  return (
    <main className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      <div className="w-1/3 max-w-sm p-6 bg-gray-800 shadow-lg overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-white">Report Configuration</h2>
        <div className="space-y-6">
            <div className="mb-6"><label className="block text-sm font-medium text-gray-400">Report Type</label><p className="text-lg font-semibold text-indigo-400">Outcome Analysis</p></div>
            <div><label htmlFor="outcome" className="block text-sm font-medium text-gray-400">Outcome</label><select id="outcome" name="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">{outcomeOptions.map(option => (<option key={option} value={option}>{option}</option>))}</select></div>
            <div><h3 className="text-lg font-semibold mb-2 text-gray-100">Filters</h3><div className="space-y-4"><div><label htmlFor="timePeriod" className="block text-sm font-medium text-gray-400">Time Period</label><select id="timePeriod" name="timePeriod" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="this_year">This Year</option><option value="last_quarter">Last Quarter</option><option value="last_month">Last Month</option></select></div><div><label htmlFor="companyCountry" className="block text-sm font-medium text-gray-400">Company Country</label><select id="companyCountry" name="companyCountry" value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="all">All Countries</option>{countryOptions.map(option => (<option key={option} value={option}>{option}</option>))}</select></div><div><label htmlFor="numberOfEmployees" className="block text-sm font-medium text-gray-400">Number of Employees</label><select id="numberOfEmployees" name="numberOfEmployees" value={numberOfEmployees} onChange={(e) => setNumberOfEmployees(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="all">All Sizes</option>{employeeOptions.map(option => (<option key={option} value={option}>{option}</option>))}</select></div></div></div>
            <div><h3 className="text-lg font-semibold mb-2 text-gray-100">Chart Settings</h3><fieldset className="space-y-2"><legend className="text-sm font-medium text-gray-400">Chart Mode</legend><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="chartMode" value="single_segmented" checked={chartMode === 'single_segmented'} onChange={(e) => setChartMode(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Breakdown</span></label><label className="flex items-center"><input type="radio" name="chartMode" value="multi_metric" checked={chartMode === 'multi_metric'} onChange={(e) => setChartMode(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Multiple Metrics</span></label></div></fieldset>
            {chartMode === 'single_segmented' && (<div className="mt-4 space-y-4"><div><label htmlFor="chartMetric" className="block text-sm font-medium text-gray-400">Metric</label><select id="chartMetric" name="chartMetric" value={chartMetric} onChange={(e) => setChartMetric(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="totalValue">Total Value</option><option value="totalDeals">Total Deals</option><option value="influencedValue">Influenced Value</option></select></div><div><label htmlFor="segmentationProperty" className="block text-sm font-medium text-gray-400">Breakdown by</label><select id="segmentationProperty" name="segmentationProperty" value={segmentationProperty} onChange={(e) => setSegmentationProperty(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="companyCountry">Company Country</option><option value="numberOfEmployees">Number of Employees</option></select></div></div>)}
            {chartMode === 'multi_metric' && (<div className="mt-4 space-y-2"><label className="flex items-center"><input type="checkbox" name="totalValue" checked={multiMetrics.totalValue} onChange={handleMultiMetricChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="ml-2">Total Value</span></label><label className="flex items-center"><input type="checkbox" name="totalDeals" checked={multiMetrics.totalDeals} onChange={handleMultiMetricChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="ml-2">Total Deals</span></label><label className="flex items-center"><input type="checkbox" name="influencedValue" checked={multiMetrics.influencedValue} onChange={handleMultiMetricChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="ml-2">Influenced Value</span></label></div>)}
            </div>
        </div>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">Your Report</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {isLoading ? (<p className="col-span-3">Loading data...</p>) : kpiData ? (<>
              <KpiCard title="Total Value" value={kpiData.totalValue} />
              <KpiCard title="Influenced Value" value={kpiData.influencedValue} />
              <KpiCard title="Total Deals" value={kpiData.totalDeals} />
            </>) : (<p className="col-span-3">No data available.</p>
          )}
        </div>
        <div className="mt-8">
            {/* UPDATED: Pass the new props to the Chart component */}
            <Chart data={chartData} mode={chartMode} config={currentConfig} />
        </div>
        <div className="mt-8 bg-gray-800 p-4 shadow rounded-lg">
          <h3 className="text-lg font-semibold text-gray-100 mb-2">Current Configuration State</h3>
          <pre className="text-sm text-yellow-300 bg-gray-900 p-4 rounded-md overflow-x-auto">{JSON.stringify(currentConfig, null, 2)}</pre>
        </div>
      </div>
    </main>
  );
}
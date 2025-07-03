// app/report/[id]/page.tsx
"use client"; 

import React, { useState, useEffect, useMemo, useRef } from 'react';
import KpiCard from '../../components/KpiCard';
import Chart from '../../components/Chart';
import Table from '../../components/Table';
import { MultiSelectFilter, OptionType } from '../../components/MultiSelectFilter';
import { X, Save, PanelLeftClose, PanelRightClose, MessageSquare, SlidersHorizontal, ChevronsRight, ChevronsLeft } from 'lucide-react';
import ChatInterface from '../../components/ChatInterface';
import useLocalStorage from '@/hooks/useLocalStorage';
import SaveReportDialog from '@/app/components/SaveReportDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// --- State Shape Interfaces ---
type Message = {
  sender: 'user' | 'bot' | 'loading';
  text: string;
};

interface KpiCardConfig { id: number; metric: string; }

interface OutcomeReportState {
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

interface EngagementReportState {
  reportFocus: string;
  timePeriod: string;
  metrics: {
    base: string[];
    influenced: { [stageName: string]: ('deals' | 'value')[] };
    attributed: { [stageName: string]: ('deals')[] };
  };
  filters: {
    eventNames: string[];
    signals: string[];
    url: string;
    selectedChannels: string[];
  };
  funnelLength: string;
  chartMode: string;
  singleChartMetric: string;
  multiChartMetrics: string[];
  segmentationProperty: string;
  kpiCardConfig: KpiCardConfig[];
}

const defaultEngagementConfig: EngagementReportState = {
    reportFocus: 'time_series',
    timePeriod: 'this_year',
    metrics: { base: [], influenced: {}, attributed: {} },
    filters: { eventNames: [], signals: [], url: '', selectedChannels: [] },
    funnelLength: 'unlimited',
    chartMode: 'multi_metric',
    singleChartMetric: 'sessions',
    multiChartMetrics: [],
    segmentationProperty: 'channel',
    kpiCardConfig: [],
};

const defaultOutcomeConfig: OutcomeReportState = {
    reportFocus: 'time_series',
    timePeriod: 'this_year',
    selectedMetrics: {},
    selectedCountries: [],
    selectedEmployeeSizes: [],
    chartMode: 'multiple_metrics',
    singleChartMetric: '',
    multiChartMetrics: [],
    segmentationProperty: 'companyCountry',
    kpiCardConfig: [],
};

interface SavedReport {
  id: string;
  name: string;
  config: {
    reportArchetype: string;
    [key: string]: any;
  };
  createdAt: string;
}

// Define the correct props interface for a Next.js Page Component with promises
interface ReportPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function ReportPage({ params: paramsPromise, searchParams: searchParamsPromise }: ReportPageProps) {
  // Unwrap the promises using React.use()
  const params = React.use(paramsPromise);
  const searchParams = React.use(searchParamsPromise);

  const promptSubmitted = useRef(false);
  const [savedReports, setSavedReports] = useLocalStorage<SavedReport[]>('savedReports', []);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isConfigPanelCollapsed, setIsConfigPanelCollapsed] = useState(false);

  // --- Primary State ---
  const [reportArchetype, setReportArchetype] = useState('outcome_analysis'); 
  
  // --- Independent State Objects for Each Report ---
  const [outcomeConfig, setOutcomeConfig] = useState<OutcomeReportState>(defaultOutcomeConfig);
  const [engagementConfig, setEngagementConfig] = useState<EngagementReportState>(defaultEngagementConfig);
  
  // --- CHAT-RELATED STATE ---
  const [activeView, setActiveView] = useState<'prompt' | 'configure'>('prompt');
  const [messages, setMessages] = useState<Message[]>([
      { sender: 'bot', text: "Hello! Describe the report you'd like to see." }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');

  // UI and Data Fetching State
  const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isKpiConfigOpen, setIsKpiConfigOpen] = useState(false);
  const [isChartTableSettingsOpen, setIsChartTableSettingsOpen] = useState(false);
  const [kpiData, setKpiData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dropdown options
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<OptionType[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<OptionType[]>([]);
  const [eventNameOptions, setEventNameOptions] = useState<OptionType[]>([]);
  const [signalOptions, setSignalOptions] = useState<OptionType[]>([]);
  const [channelOptions, setChannelOptions] = useState<OptionType[]>([]);

  // --- DERIVED STATE ---
  const { currentConfig, availableMetricsForChart, allAvailableMetrics } = useMemo(() => {
    const sanitize = (name: string) => name.replace(/\s/g, '_');

    if (reportArchetype === 'outcome_analysis') {
      const allMetrics = Object.entries(outcomeConfig.selectedMetrics).flatMap(([stage, metricTypes]) => 
        metricTypes.map(metricType => `${sanitize(stage)}_${metricType}`)
      ).sort();
      return { currentConfig: outcomeConfig, availableMetricsForChart: allMetrics, allAvailableMetrics: allMetrics };
    }
    
    // Engagement Analysis
    const all = [
      ...(engagementConfig.metrics.base || []),
      ...Object.entries(engagementConfig.metrics.influenced || {}).flatMap(([stage, metricTypes]) => 
        metricTypes.map(metricType => `influenced_${sanitize(stage)}_${metricType}`)
      ),
      ...Object.entries(engagementConfig.metrics.attributed || {}).flatMap(([stage, metricTypes]) => 
        metricTypes.includes('deals') ? [`attributed_${sanitize(stage)}_deals`] : []
      ),
    ].sort();
    
    const chartTableMetrics = [
        ...(engagementConfig.metrics.base || []),
        ...Object.keys(engagementConfig.metrics.influenced || {}).map(stage => `influenced_${sanitize(stage)}_deals`),
        ...Object.keys(engagementConfig.metrics.attributed || {}).map(stage => `attributed_${sanitize(stage)}_deals`),
    ].filter(metric => all.includes(metric)).sort();

    return { currentConfig: engagementConfig, availableMetricsForChart: chartTableMetrics, allAvailableMetrics: all };
  }, [reportArchetype, outcomeConfig, engagementConfig]);

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
        setChannelOptions((data.channels || []).map((c: string) => ({ value: c, label: c })));
      } catch (error) { console.error("Failed to fetch dropdown options:", error); }
    };
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    const initialPrompt = searchParams?.prompt;
    if (typeof initialPrompt === 'string' && params.id === 'new' && !promptSubmitted.current) {
        promptSubmitted.current = true;
        handleQuerySubmit(initialPrompt);
    } else if (params.id && params.id !== 'new') {
        const reportToLoad = savedReports.find(r => r.id === params.id);
        if (reportToLoad) {
            const { config } = reportToLoad;
            setReportArchetype(config.reportArchetype);
            if (config.reportArchetype === 'outcome_analysis') {
                setOutcomeConfig({ ...defaultOutcomeConfig, ...config });
            } else {
                setEngagementConfig({ ...defaultEngagementConfig, ...config });
            }
        }
    }
  }, [params.id, searchParams, savedReports]);

  useEffect(() => {
    if (reportArchetype === 'outcome_analysis') {
      const { multiChartMetrics, singleChartMetric, kpiCardConfig } = outcomeConfig;
      const syncedMulti = multiChartMetrics.filter(metric => allAvailableMetrics.includes(metric));
      const syncedSingle = allAvailableMetrics.includes(singleChartMetric) ? singleChartMetric : (allAvailableMetrics[0] || '');
      const syncedKpis = kpiCardConfig.filter(card => allAvailableMetrics.includes(card.metric));
      if (syncedMulti.length !== multiChartMetrics.length || syncedSingle !== singleChartMetric || syncedKpis.length !== kpiCardConfig.length) {
        setOutcomeConfig(prev => ({ ...prev, multiChartMetrics: syncedMulti, singleChartMetric: syncedSingle, kpiCardConfig: syncedKpis }));
      }
    } else if (reportArchetype === 'engagement_analysis') {
      const { multiChartMetrics, singleChartMetric, kpiCardConfig } = engagementConfig;
      const syncedMulti = multiChartMetrics.filter(metric => availableMetricsForChart.includes(metric));
      const syncedSingle = availableMetricsForChart.includes(singleChartMetric) ? singleChartMetric : (availableMetricsForChart[0] || '');
      const syncedKpis = kpiCardConfig.filter(card => allAvailableMetrics.includes(card.metric));
      if (syncedMulti.length !== multiChartMetrics.length || syncedSingle !== singleChartMetric || syncedKpis.length !== kpiCardConfig.length) {
        setEngagementConfig(prev => ({ ...prev, multiChartMetrics: syncedMulti, singleChartMetric: syncedSingle, kpiCardConfig: syncedKpis }));
      }
    }
  }, [availableMetricsForChart, allAvailableMetrics, reportArchetype, engagementConfig, outcomeConfig]);

  useEffect(() => {
    const fetchData = async () => {
      const configForApi = { reportArchetype, ...currentConfig };
      if (reportArchetype === 'outcome_analysis' && Object.keys(outcomeConfig.selectedMetrics).length === 0 && engagementConfig.metrics.base.length === 0) {
        setIsLoading(false); setKpiData(null); setChartData([]); return;
      }
      setIsLoading(true);
      try {
        const reportResponse = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }, body: JSON.stringify(configForApi) });
        if (!reportResponse.ok) throw new Error('Network response was not ok');
        const reportData = await reportResponse.json();
        setKpiData(reportData.kpiData);
        setChartData(reportData.chartData);

        if (currentQuery) {
            const chatResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: currentQuery, 
                    kpiData: reportData.kpiData, 
                    chartData: reportData.chartData,
                    config: configForApi 
                })
            });
            const chatData = await chatResponse.json();
            setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'bot', text: chatData.answer } : m));
            setCurrentQuery('');
        }

      } catch (error) { 
        console.error("Failed to fetch report data:", error); 
        setKpiData(null); 
        setChartData([]);
        setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'bot', text: 'Sorry, I encountered an error generating the report.' } : m));
      }
      setIsLoading(false);
      setIsGenerating(false);
    };
    
    if ((!isGenerating || currentQuery) && (Object.keys(outcomeConfig.selectedMetrics).length > 0 || engagementConfig.metrics.base.length > 0)) {
        const handler = setTimeout(() => { fetchData(); }, 500);
        return () => { clearTimeout(handler); };
    }
  }, [JSON.stringify(currentConfig), reportArchetype, currentQuery, isGenerating, outcomeConfig.selectedMetrics, engagementConfig.metrics.base]);

  // --- HANDLERS ---
  const handleQuerySubmit = async (query: string) => {
    setIsGenerating(true);
    setMessages(prev => [...prev, { sender: 'user', text: query }, { sender: 'loading', text: 'Digging in to terabytes of GTM data...' }]);
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();

        if (data.error) throw new Error(data.details || data.error);

        if (data.config.reportArchetype === 'outcome_analysis') {
            setOutcomeConfig(data.config);
        } else {
            setEngagementConfig(data.config);
        }
        setReportArchetype(data.config.reportArchetype);
        setCurrentQuery(query);
        setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'loading', text: 'Got the data - now I just have to build your report...' } : m));

    } catch (error) {
        console.error("Something went wrong and I couldn't generate a report from prompt:", error);
        setIsGenerating(false);
        const errorMessage = error instanceof Error ? error.message : 'Sorry, this was too hard for me. Could you try rephrasing?';
        setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'bot', text: errorMessage } : m));
    }
  };


  const handleConfigChange = (key: string, value: any) => {
    const setState = reportArchetype === 'outcome_analysis' ? setOutcomeConfig : setEngagementConfig;
    setState((prev: any) => ({ ...prev, [key]: value }));
  };
  
  const handleMetricChange = (isOutcome: boolean, path: string, value: string | 'deals' | 'value', isChecked?: boolean) => {
    const setState = isOutcome ? setOutcomeConfig : setEngagementConfig;
    setState((prev: any) => {
      const newState = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let current = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      const metricGroup = keys[keys.length-1];
      if (typeof isChecked !== 'undefined') {
        const metricArray = current[metricGroup] || [];
        if(isChecked) current[metricGroup] = [...metricArray, value];
        else current[metricGroup] = metricArray.filter((v: string) => v !== value);
        if(keys.length > 1 && current[metricGroup].length === 0) delete current[metricGroup];
      } else {
         current[metricGroup] = value;
      }
      return newState;
    });
  };

  const addKpiCard = () => {
    if (allAvailableMetrics.length > 0) {
      const newCard = { id: Date.now(), metric: allAvailableMetrics[0] };
      handleConfigChange('kpiCardConfig', [...currentConfig.kpiCardConfig, newCard]);
    }
  };
  
  const removeKpiCard = (idToRemove: number) => {
    const newKpiConfig = currentConfig.kpiCardConfig.filter(card => card.id !== idToRemove);
    handleConfigChange('kpiCardConfig', newKpiConfig);
  };
  
  const updateKpiCardMetric = (idToUpdate: number, newMetric: string) => {
    const newKpiConfig = currentConfig.kpiCardConfig.map(card => card.id === idToUpdate ? { ...card, metric: newMetric } : card );
    handleConfigChange('kpiCardConfig', newKpiConfig);
  };
  
  const handleSaveReport = (name: string) => {
    const newReport: SavedReport = {
      id: Date.now().toString(),
      name,
      config: { reportArchetype, ...currentConfig },
      createdAt: new Date().toISOString(),
    };
    setSavedReports([...savedReports, newReport]);
  };
  
  // --- RENDER FUNCTION ---
  const renderConfigurationPanels = () => {
    const isOutcome = reportArchetype === 'outcome_analysis';
    const config = isOutcome ? outcomeConfig : engagementConfig;
    const setState = (key: string, value: any) => handleConfigChange(key, value);
    const setMetric = (path: string, value: any, isChecked?: boolean) => handleMetricChange(isOutcome, path, value, isChecked);

    const breakdownOptions = isOutcome ? (
        <>
            <option value="companyCountry">Company Country</option>
            <option value="numberOfEmployees">Number of Employees</option>
        </>
    ) : (
        <>
            <option value="channel">Channel</option>
            <option value="companyCountry">Company Country</option>
            <option value="numberOfEmployees">Number of Employees</option>
        </>
    );
    
    const timePeriodOptions = (
        <select value={config.timePeriod} onChange={(e) => setState('timePeriod', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
            <option value="this_month">This Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="last_month">Last Month</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="last_year">Last Year</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="last_12_months">Last 12 Months</option>
        </select>
    );

    return (
      <div className="p-6 space-y-4 divide-y divide-gray-700">
        <div className="pt-4">
          <button onClick={() => setIsGeneralSettingsOpen(!isGeneralSettingsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white">
              <span>General Settings</span>
              <span className="text-xs">{isGeneralSettingsOpen ? '▼' : '►'}</span>
          </button>
          {isGeneralSettingsOpen && (
            <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">
              <div><h3 className="text-md font-medium mb-2 text-gray-200">Report Type</h3><fieldset className="flex gap-4"><label className="flex items-center"><input type="radio" name="reportArchetype" value="outcome_analysis" checked={reportArchetype === 'outcome_analysis'} onChange={(e) => setReportArchetype(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300" /><span className="ml-2">Outcome Analysis</span></label><label className="flex items-center"><input type="radio" name="reportArchetype" value="engagement_analysis" checked={reportArchetype === 'engagement_analysis'} onChange={(e) => setReportArchetype(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300" /><span className="ml-2">Engagement Analysis</span></label></fieldset></div>
              <div><h3 className="text-md font-medium mb-2 text-gray-200">Report Focus</h3><fieldset className="flex gap-4"><label className="flex items-center"><input type="radio" name="reportFocus" value="time_series" checked={config.reportFocus === 'time_series'} onChange={(e) => setState('reportFocus', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Time Series</span></label><label className="flex items-center"><input type="radio" name="reportFocus" value="segmentation" checked={config.reportFocus === 'segmentation'} onChange={(e) => setState('reportFocus', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Segmentation</span></label></fieldset></div>
            </div>
          )}
        </div>
        <div className="pt-4"><button onClick={() => setIsMetricsOpen(!isMetricsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Metrics</span><span className="text-xs">{isMetricsOpen ? '▼' : '►'}</span></button>
          {isMetricsOpen && (isOutcome ? 
            <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">{stageOptions.map(stage => (<div key={stage}><p className="font-medium text-white">{stage}</p><div className="pl-2 mt-1 space-y-1"><label className="flex items-center"><input type="checkbox" checked={outcomeConfig.selectedMetrics[stage]?.includes('deals')} onChange={(e) => setMetric(`selectedMetrics.${stage}`, 'deals', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Deals</span></label><label className="flex items-center"><input type="checkbox" checked={outcomeConfig.selectedMetrics[stage]?.includes('value')} onChange={(e) => setMetric(`selectedMetrics.${stage}`, 'value', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Value</span></label></div></div>))}</div>
            :
            <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4">
                <div>
                    <p className="font-medium text-white">Base Metrics</p>
                    <div className="pl-2 mt-1 space-y-1">
                        <label className="flex items-center"><input type="checkbox" checked={engagementConfig.metrics.base.includes('companies')} onChange={(e) => setMetric('metrics.base', 'companies', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Companies</span></label>
                        <label className="flex items-center"><input type="checkbox" checked={engagementConfig.metrics.base.includes('contacts')} onChange={(e) => setMetric('metrics.base', 'contacts', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Contacts</span></label>
                        <label className="flex items-center"><input type="checkbox" checked={engagementConfig.metrics.base.includes('events')} onChange={(e) => setMetric('metrics.base', 'events', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Events</span></label>
                        <label className="flex items-center"><input type="checkbox" checked={engagementConfig.metrics.base.includes('sessions')} onChange={(e) => setMetric('metrics.base', 'sessions', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Sessions</span></label>
                    </div>
                </div>
                {stageOptions.map(stage => (
                    <div key={stage} className="pl-2 mt-1">
                        <p className="font-medium text-gray-300">{stage}</p>
                        <div className="pl-2 mt-1 space-y-1">
                            <label className="flex items-center"><input type="checkbox" checked={engagementConfig.metrics.influenced[stage]?.includes('deals')} onChange={(e) => setMetric(`metrics.influenced.${stage}`, 'deals', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Touched Deals</span></label>
                            <label className="flex items-center"><input type="checkbox" checked={engagementConfig.metrics.attributed[stage]?.includes('deals')} onChange={(e) => setMetric(`metrics.attributed.${stage}`, 'deals', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2"># Attributed Deals</span></label>
                            <label className="flex items-center"><input type="checkbox" checked={engagementConfig.metrics.influenced[stage]?.includes('value')} onChange={(e) => setMetric(`metrics.influenced.${stage}`, 'value', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">Touched Value</span></label>
                        </div>
                    </div>
                ))}
            </div>
          )}
        </div>
        <div className="pt-4"><button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Filters</span><span className="text-xs">{isFiltersOpen ? '▼' : '►'}</span></button>
          {isFiltersOpen && (isOutcome ?
            <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Time Period</label>{timePeriodOptions}</div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Company Country</label><MultiSelectFilter options={countryOptions} selected={outcomeConfig.selectedCountries} onChange={(v) => setState('selectedCountries', v)} placeholder="Select countries..."/></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Number of Employees</label><MultiSelectFilter options={employeeOptions} selected={outcomeConfig.selectedEmployeeSizes} onChange={(v) => setState('selectedEmployeeSizes', v)} placeholder="Select sizes..."/></div>
            </div>
            :
            <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Time Period</label>{timePeriodOptions}</div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Funnel Length</label>
                  <select value={engagementConfig.funnelLength} onChange={(e) => handleConfigChange('funnelLength', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="unlimited">Unlimited</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Channel</label><MultiSelectFilter options={channelOptions} selected={engagementConfig.filters.selectedChannels} onChange={(v) => handleConfigChange('filters', {...engagementConfig.filters, selectedChannels: v})} placeholder="Select channels..."/></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Event Name</label><MultiSelectFilter options={eventNameOptions} selected={engagementConfig.filters.eventNames} onChange={(v) => handleConfigChange('filters', {...engagementConfig.filters, eventNames: v})} placeholder="Select events..."/></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Signal</label><MultiSelectFilter options={signalOptions} selected={engagementConfig.filters.signals} onChange={(v) => handleConfigChange('filters', {...engagementConfig.filters, signals: v})} placeholder="Select signals..."/></div>
                <div><label htmlFor="urlFilter" className="block text-sm font-medium text-gray-400">URL Contains</label><input type="text" id="urlFilter" value={engagementConfig.filters.url} onChange={(e) => handleConfigChange('filters', {...engagementConfig.filters, url: e.target.value})} className="mt-1 block w-full bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md p-2"/></div>
            </div>
          )}
        </div>
        <div className="pt-4">
          <button onClick={() => setIsKpiConfigOpen(!isKpiConfigOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>KPI Card Configuration</span><span className="text-xs">{isKpiConfigOpen ? '▼' : '►'}</span></button>
          {isKpiConfigOpen && <div className="mt-2 space-y-2 border-l-2 border-gray-700 pl-4 pt-2">
              {config.kpiCardConfig.map((card, index) => (
                <div key={card.id} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded-md">
                  <span className="text-sm font-medium text-gray-400">Card {index + 1}:</span>
                  <select value={card.metric} onChange={(e) => updateKpiCardMetric(card.id, e.target.value)} className="flex-1 block w-full text-xs bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md" disabled={allAvailableMetrics.length === 0}>
                    {allAvailableMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                  </select>
                  <button onClick={() => removeKpiCard(card.id)} className="p-1 text-gray-500 hover:text-red-400"><X size={16}/></button>
                </div>
              ))}
              <button onClick={addKpiCard} className="mt-2 w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500" disabled={allAvailableMetrics.length === 0}>+ Add KPI Card</button>
          </div>}
        </div>
        <div className="pt-4"><button onClick={() => setIsChartTableSettingsOpen(!isChartTableSettingsOpen)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-100 hover:text-white"><span>Chart & Table Settings</span><span className="text-xs">{isChartTableSettingsOpen ? '▼' : '►'}</span></button>{isChartTableSettingsOpen && <div className="mt-2 space-y-4 border-l-2 border-gray-700 pl-4 pt-2">{config.reportFocus === 'time_series' ? (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Time Series Chart</h3><fieldset className="space-y-2"><legend className="text-sm font-medium text-gray-400">Chart Mode</legend><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="chartMode" value="single_segmented" checked={config.chartMode === 'single_segmented'} onChange={(e) => setState('chartMode', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Breakdown</span></label><label className="flex items-center"><input type="radio" name="chartMode" value="multi_metric" checked={config.chartMode === 'multi_metric'} onChange={(e) => setState('chartMode', e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300"/><span className="ml-2">Multiple Metrics</span></label></div></fieldset>{config.chartMode === 'single_segmented' ? (<div className="mt-4 space-y-4"><div><label className="block text-sm font-medium text-gray-400">Metric</label><select value={config.singleChartMetric} onChange={(e) => setState('singleChartMetric', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" disabled={availableMetricsForChart.length === 0}>{availableMetricsForChart.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</select></div><div><label className="block text-sm font-medium text-gray-400">Breakdown by</label><select value={config.segmentationProperty} onChange={(e) => setState('segmentationProperty', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">{breakdownOptions}</select></div></div>) : (<div className="mt-4 space-y-2">{availableMetricsForChart.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" checked={config.multiChartMetrics.includes(metric)} onChange={() => setState('multiChartMetrics', config.multiChartMetrics.includes(metric) ? config.multiChartMetrics.filter(m => m !== metric) : [...config.multiChartMetrics, metric])} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div>)}</div>) : (<div><h3 className="text-md font-semibold mb-2 text-gray-200">Segmentation Chart & Table</h3><div className="space-y-4"><div><label className="block text-sm font-medium text-gray-400">Breakdown by</label><select value={config.segmentationProperty} onChange={(e) => setState('segmentationProperty', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">{breakdownOptions}</select></div><div><label className="block text-sm font-medium text-gray-400">Metrics to Display</label><div className="mt-2 space-y-2">{availableMetricsForChart.map(metric => (<label key={metric} className="flex items-center"><input type="checkbox" checked={config.multiChartMetrics.includes(metric)} onChange={() => setState('multiChartMetrics', config.multiChartMetrics.includes(metric) ? config.multiChartMetrics.filter(m => m !== metric) : [...config.multiChartMetrics, metric])} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /><span className="ml-2">{metric.replace(/_/g, ' ')}</span></label>))}</div></div></div></div>)}</div>}</div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <>
      <SaveReportDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSaveReport}
      />
      <div className="flex h-full">
        <div className={cn(
          "bg-gray-800 shadow-lg transition-all duration-300 ease-in-out flex flex-col",
          isConfigPanelCollapsed ? "w-20" : "w-1/3 max-w-md"
        )}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                <h2 className={cn("text-xl font-semibold text-white", isConfigPanelCollapsed && "sr-only")}>
                    Report Builder
                </h2>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsConfigPanelCollapsed(!isConfigPanelCollapsed)} 
                    className="h-8 w-8"
                >
                    {isConfigPanelCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
                </Button>
            </div>

            <div className={cn("flex flex-col flex-grow overflow-y-auto min-h-0", isConfigPanelCollapsed && "hidden")}>
                <div className="p-4 border-b border-gray-700">
                    <div className="flex bg-gray-700 rounded-md p-1">
                        <button onClick={() => setActiveView('prompt')} className={`w-1/2 py-2 text-sm font-medium rounded ${activeView === 'prompt' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>Prompt</button>
                        <button onClick={() => setActiveView('configure')} className={`w-1/2 py-2 text-sm font-medium rounded ${activeView === 'configure' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>Configure</button>
                    </div>
                </div>
                {activeView === 'prompt' ? (
                    <ChatInterface onQuerySubmit={handleQuerySubmit} messages={messages} isGenerating={isGenerating} />
                ) : (
                    renderConfigurationPanels()
                )}
            </div>

            {isConfigPanelCollapsed && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                <button onClick={() => setActiveView('prompt')} className={cn("p-2 rounded-md", activeView === 'prompt' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700')}>
                    <MessageSquare size={24} />
                </button>
                <button onClick={() => setActiveView('configure')} className={cn("p-2 rounded-md", activeView === 'configure' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700')}>
                    <SlidersHorizontal size={24} />
                </button>
            </div>
            )}
        </div>
        
        <div className="flex-shrink-0 bg-gray-700 w-px" />
        
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-white">Your Report</h1>
            <Button
              onClick={() => setIsSaveDialogOpen(true)}
              className="gap-2"
            >
              <Save size={16} />
              <span>Save Report</span>
            </Button>
          </div>
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentConfig.kpiCardConfig.map(card => (
              <KpiCard key={card.id} title={(card.metric || '').replace(/_/g, ' ')} value={isLoading ? '...' : (kpiData ? kpiData[card.metric] : "-")} />
            ))}
          </div>
          <div className="space-y-8">
            <Chart data={chartData} mode={currentConfig.reportFocus === 'segmentation' ? 'bar' : currentConfig.chartMode} config={currentConfig} />
            <Table data={chartData} mode={currentConfig.reportFocus} config={currentConfig} />
          </div>
          <div className="mt-8 bg-gray-800 p-4 shadow rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Current Configuration State</h3>
            <pre className="text-sm text-yellow-300 bg-gray-900 p-4 rounded-md overflow-x-auto">{JSON.stringify({ reportArchetype, ...currentConfig }, null, 2)}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
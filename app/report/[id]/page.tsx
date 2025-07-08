// app/report/[id]/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { outcomePanelConfig } from '@/config/outcomePanelConfig';
import { engagementPanelConfig } from '@/config/engagementPanelConfig';
import DynamicConfigPanel from '@/app/components/DynamicConfigPanel';
import { Check, ChevronDown, ChevronRight, Save, MessageSquare, SlidersHorizontal, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KpiCard from '@/app/components/KpiCard';
import Chart from '@/app/components/Chart';
import Table from '@/app/components/Table';
import SaveReportDialog from '@/app/components/SaveReportDialog';
import ChatInterface from '@/app/components/ChatInterface';
import { cn } from '@/lib/utils';

type Message = {
  sender: 'user' | 'bot' | 'loading';
  text: string;
};

const initialReportState = {
    id: '',
    name: 'New Report',
    description: '',
    reportArchetype: '',
    dataConfig: {
        timePeriod: 'this_year',
        reportFocus: 'time_series',
        metrics: {},
        selectedCountries: [],
        selectedEmployeeSizes: [],
        funnelLength: 'unlimited',
        filters: {
            selectedChannels: [],
            eventNames: [],
            signals: [],
            url: '',
        },
    },
    kpiCards: [],
    chart: { title: 'Chart', variant: 'time_series_line', metrics: [], breakdown: '' },
    table: { title: 'Data Table', variant: 'time_series_by_metric' },
};


const Section = ({ title, isOpen, onToggle, children }: { title: string, isOpen: boolean, onToggle: () => void, children: React.ReactNode }) => (
    <div className="border-t border-gray-700">
        <button onClick={onToggle} className="w-full flex justify-between items-center p-4 text-left text-lg font-semibold text-gray-100 hover:bg-gray-700/50">
            <span>{title}</span>
            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
        {isOpen && <div>{children}</div>}
    </div>
);

export default function ReportPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const promptSubmitted = useRef(false);

    const [reportState, setReportState] = useState<any>(initialReportState);
    const [dynamicOptions, setDynamicOptions] = useState<{ [key: string]: any }>({});
    const [openSections, setOpenSections] = useState({
        settings: true,
        filters: true,
        kpis: true,
        visualizations: true,
    });
    
    const [kpiData, setKpiData] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    
    // Chat state
    const [activeView, setActiveView] = useState<'prompt' | 'configure'>('configure');
    const [messages, setMessages] = useState<Message[]>([ { sender: 'bot', text: "What would you love to know?" } ]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentQuery, setCurrentQuery] = useState('');
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);


    useEffect(() => {
        const fetchDropdownOptions = async () => {
          try {
            const response = await fetch('/api/config-options', { headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }});
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            setDynamicOptions({
                countryOptions: (data.countries || []).map((c: string) => ({ value: c, label: c })),
                employeeOptions: (data.employeeBuckets || []).map((e: string) => ({ value: e, label: e })),
                eventNameOptions: (data.eventNames || []).map((e: string) => ({ value: e, label: e })),
                signalOptions: (data.signalNames || []).map((s: string) => ({ value: s, label: s })),
                channelOptions: (data.channels || []).map((c: string) => ({ value: c, label: c })),
                stageOptions: (data.outcomes || []),
            });
          } catch (error) { console.error("Failed to fetch dropdown options:", error); }
        };
        fetchDropdownOptions();
    }, []);

    useEffect(() => {
        const initialPrompt = searchParams.get('prompt');
        if (id && id !== 'new') {
            const fetchReport = async () => {
                setIsLoading(true);
                try {
                    const res = await fetch(`/api/reports/${id}`);
                    if (res.ok) {
                        const reportToLoad = await res.json();
                        setReportState(reportToLoad);
                        setActiveView('configure');
                    } else {
                        router.push('/reports');
                    }
                } catch (error) {
                    console.error("Failed to load report", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchReport();
        } else if (initialPrompt && !promptSubmitted.current) {
            promptSubmitted.current = true;
            setActiveView('prompt');
            handleQuerySubmit(initialPrompt);
        } else if (!promptSubmitted.current) {
            setReportState(initialReportState);
            setActiveView('configure');
        }
    }, [id, router, searchParams]);

    useEffect(() => {
        const configForApi = { ...reportState };
        const hasMetrics = (configForApi.reportArchetype === 'outcome_analysis' && Object.keys(configForApi.dataConfig?.metrics || {}).length > 0) || 
                           (configForApi.reportArchetype === 'engagement_analysis' && (configForApi.dataConfig?.metrics?.base?.length > 0 || Object.keys(configForApi.dataConfig?.metrics?.influenced || {}).length > 0));

        if (!configForApi.reportArchetype || !hasMetrics) {
            setKpiData(null);
            setChartData([]);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/v2/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(configForApi)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.details || 'Failed to fetch report data');
                
                setKpiData(data.kpiData);
                setChartData(data.chartData);

                if (currentQuery) {
                    const chatResponse = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: currentQuery, kpiData: data.kpiData, chartData: data.chartData, config: configForApi })
                    });
                    const chatData = await chatResponse.json();
                    setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'bot', text: chatData.answer || "I've configured the report for you." } : m));
                    setCurrentQuery('');
                }
            } catch (error) {
                console.error(error);
                setKpiData(null);
                setChartData([]);
                if (currentQuery) {
                    setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'bot', text: "Sorry, I couldn't fetch data for that report." } : m));
                }
            } finally {
                setIsLoading(false);
                setIsGenerating(false);
            }
        };

        const handler = setTimeout(() => {
            fetchData();
        }, 500);

        return () => clearTimeout(handler);
    }, [reportState, currentQuery]);

    const handleQuerySubmit = async (query: string) => {
        setIsGenerating(true);
        setMessages(prev => [...prev, { sender: 'user', text: query }, { sender: 'loading', text: 'Digging through teta bytes of data...' }]);
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Failed to get configuration from AI.');
            }

            const data = await response.json();
            setReportState(data.config);
            setCurrentQuery(query);
            setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'loading', text: 'Building your GTM insights...' } : m));

        } catch (error) {
            console.error("Error during query submission:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setMessages(prev => prev.map(m => m.sender === 'loading' ? { sender: 'bot', text: `Sorry, I hit an error: ${errorMessage}` } : m));
            setIsGenerating(false);
        }
    };

    // ... (other handlers: toggleSection, handleStateChange, handleMetricChange, etc. remain the same)
    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };
    
    const handleStateChange = (path: string, value: any) => {
        setReportState((prevState: any) => {
            const keys = path.split('.');
            const newState = { ...prevState };
            let current: any = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]] = current[keys[i]] || {};
            }
            current[keys[keys.length - 1]] = value;
            return newState;
        });
    };
    
    const handleMetricChange = (path: string, value: string, isChecked: boolean) => {
        setReportState((prevState: any) => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const pathParts = `dataConfig.metrics.${path}`.split('.');
            
            let current = newState;
            for (let i = 0; i < pathParts.length - 1; i++) {
                current = current[pathParts[i]] = current[pathParts[i]] || {};
            }
            
            let metricList = current[pathParts[pathParts.length - 1]] || [];
            if(isChecked) {
                metricList = [...new Set([...metricList, value])];
            } else {
                metricList = metricList.filter((m: string) => m !== value);
            }
            current[pathParts[pathParts.length - 1]] = metricList;
            
            return newState;
        });
    };

    const handleArchetypeChange = (archetype: string) => {
        setReportState((prevState: any) => ({
            ...initialReportState,
            name: prevState.name,
            description: prevState.description,
            reportArchetype: archetype,
        }));
    };

    const availableKpiMetrics = useMemo(() => {
        const metrics = reportState?.dataConfig?.metrics;
        if (!metrics) return [];

        if (reportState.reportArchetype === 'outcome_analysis') {
            return Object.entries(metrics).flatMap(([stage, types]: [string, any]) => 
                types.map((type: string) => `${stage}_${type}`)
            ).sort();
        } else {
             return [
                ...(metrics.base || []),
                ...Object.entries(metrics.influenced || {}).flatMap(([stage, types]: [string, any]) => 
                    types.map((type: string) => `influenced_${stage}_${type}`)
                ),
                ...Object.entries(metrics.attributed || {}).flatMap(([stage, types]: [string, any]) => 
                    types.map((type: string) => `attributed_${stage}_${type}`)
                ),
            ].sort();
        }
    }, [reportState?.dataConfig?.metrics, reportState.reportArchetype]);


    useEffect(() => {
        const newKpiCards = availableKpiMetrics.map(metric => ({
            title: metric.replace(/_/g, ' '),
            metric: metric,
        }));

        const updatedChartMetrics = reportState.chart.metrics.filter((m: string) => availableKpiMetrics.includes(m));
        const updatedChartMetric = availableKpiMetrics.includes(reportState.chart.metric) ? reportState.chart.metric : (availableKpiMetrics[0] || '');
        
        setReportState((prev: any) => ({ 
            ...prev, 
            kpiCards: newKpiCards,
            chart: {
                ...prev.chart,
                metrics: updatedChartMetrics,
                metric: updatedChartMetric
            }
        }));

    }, [availableKpiMetrics]);
    
    const handleSave = async (reportName: string) => {
        try {
            if (id === 'new') {
                const reportToSave = { ...reportState, id: Date.now().toString(), name: reportName, createdAt: new Date().toISOString() };
                const response = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reportToSave)
                });
                const newReport = await response.json();
                if (response.ok) {
                   router.push(`/report/${newReport.id}`);
                } else {
                    throw new Error('Failed to save new report');
                }
            } else {
                const response = await fetch(`/api/reports/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...reportState, name: reportName })
                });
                 if (response.ok) {
                    setIsSaved(true);
                    setReportState((prev: any) => ({ ...prev, name: reportName }));
                    setTimeout(() => setIsSaved(false), 2000);
                 } else {
                    throw new Error('Failed to update report');
                }
            }
        } catch (error) {
             console.error("Save operation failed:", error);
        }
    };

    const onSaveClick = () => {
        if (id !== 'new') {
            handleSave(reportState.name);
        } else {
            setIsSaveDialogOpen(true);
        }
    }


    const panelConfig = useMemo(() => {
        if (reportState.reportArchetype === 'outcome_analysis') return outcomePanelConfig;
        if (reportState.reportArchetype === 'engagement_analysis') return engagementPanelConfig;
        return [];
    }, [reportState.reportArchetype]);
    
    return (
        <>
        <SaveReportDialog
            open={isSaveDialogOpen}
            onOpenChange={setIsSaveDialogOpen}
            onSave={handleSave}
        />
        <div className="flex h-full">
            <div className={cn("bg-gray-800 shadow-lg flex flex-col transition-all duration-300", isPanelCollapsed ? "w-20" : "w-1/3 max-w-md")}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 className={cn("text-xl font-semibold text-white", isPanelCollapsed && "sr-only")}>Report Builder</h2>
                     <Button variant="ghost" size="icon" onClick={() => setIsPanelCollapsed(!isPanelCollapsed)} className="h-8 w-8">
                        {isPanelCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
                    </Button>
                </div>
                <div className={cn("flex-grow flex flex-col min-h-0", isPanelCollapsed && "hidden")}>
                    <div className="p-4 border-b border-gray-700">
                        <div className="flex bg-gray-700 rounded-md p-1">
                            <button onClick={() => setActiveView('prompt')} className={cn("w-1/2 py-2 text-sm font-medium rounded", activeView === 'prompt' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600')}>Prompt</button>
                            <button onClick={() => setActiveView('configure')} className={cn("w-1/2 py-2 text-sm font-medium rounded", activeView === 'configure' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600')}>Configure</button>
                        </div>
                    </div>
                    {activeView === 'prompt' ? (
                        <ChatInterface onQuerySubmit={handleQuerySubmit} messages={messages} isGenerating={isGenerating} />
                    ) : (
                        <div className="overflow-y-auto">
                            <div className="p-4 border-b border-gray-700">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Report Type</label>
                                <select
                                    value={reportState.reportArchetype || ''}
                                    onChange={(e) => handleArchetypeChange(e.target.value)}
                                    className="block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white sm:text-sm rounded-md"
                                >
                                    <option value="" disabled>-- Select a report type --</option>
                                    <option value="outcome_analysis">Outcome Analysis</option>
                                    <option value="engagement_analysis">Engagement Analysis</option>
                                </select>
                            </div>
                            {reportState.reportArchetype ? (
                                <>
                                   <Section title="1. Report Settings" isOpen={openSections.settings} onToggle={() => toggleSection('settings')}>
                                        <DynamicConfigPanel section="settings" config={panelConfig} reportState={reportState} onStateChange={handleStateChange} onMetricChange={handleMetricChange} dynamicOptions={dynamicOptions} />
                                   </Section>
                                   <Section title="2. Filters" isOpen={openSections.filters} onToggle={() => toggleSection('filters')}>
                                        <DynamicConfigPanel section="filters" config={panelConfig} reportState={reportState} onStateChange={handleStateChange} onMetricChange={handleMetricChange} dynamicOptions={dynamicOptions} />
                                   </Section>
                                    <Section title="3. KPIs & Metrics" isOpen={openSections.kpis} onToggle={() => toggleSection('kpis')}>
                                        <DynamicConfigPanel section="kpis" config={panelConfig} reportState={reportState} onStateChange={handleStateChange} onMetricChange={handleMetricChange} dynamicOptions={dynamicOptions} />
                                   </Section>
                                   <Section title="4. Chart & Table" isOpen={openSections.visualizations} onToggle={() => toggleSection('visualizations')}>
                                         <DynamicConfigPanel 
                                            section="visualizations"
                                            config={panelConfig} 
                                            reportState={reportState} 
                                            onStateChange={handleStateChange}
                                            onMetricChange={handleMetricChange}
                                            dynamicOptions={dynamicOptions}
                                            availableKpiMetrics={availableKpiMetrics}
                                        />
                                   </Section>
                                </>
                            ) : null }
                        </div>
                    )}
                </div>
                 {isPanelCollapsed && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                        <button onClick={() => { setActiveView('prompt'); setIsPanelCollapsed(false); }} className={cn("p-2 rounded-md", activeView === 'prompt' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700')}><MessageSquare size={24} /></button>
                        <button onClick={() => { setActiveView('configure'); setIsPanelCollapsed(false); }} className={cn("p-2 rounded-md", activeView === 'configure' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700')}><SlidersHorizontal size={24} /></button>
                    </div>
                )}
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-white">{reportState.name}</h1>
                    <Button className="gap-2" onClick={onSaveClick} disabled={isSaved}>
                        {isSaved ? <Check size={16} /> : <Save size={16} />}
                        <span>{isSaved ? "Saved!" : "Save Report"}</span>
                    </Button>
                </div>
                 <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {reportState.kpiCards.map((kpi: any) => (
                        <KpiCard key={kpi.metric} title={kpi.title} value={isLoading ? '...' : (kpiData ? kpiData[kpi.metric] : "-")} />
                    ))}
                </div>
                 <div className="space-y-8">
                    <Chart data={chartData} mode={reportState.dataConfig?.reportFocus === 'segmentation' ? 'bar' : reportState.chart?.variant} config={reportState} title={reportState.chart?.title} />
                    <Table data={chartData} mode={reportState.dataConfig?.reportFocus} config={reportState} title={reportState.table?.title} />
                </div>
            </div>
        </div>
        </>
    );
}
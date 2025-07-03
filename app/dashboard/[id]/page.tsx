// app/dashboard/[id]/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import KpiCard from '../../components/KpiCard';
import Chart from '../../components/Chart';
import Table from '../../components/Table';
import { PlusCircle } from 'lucide-react';
import AddElementDialog from '../../components/AddElementDialog';

interface DashboardItem {
    id: string;
    reportConfig: any;
    elementType: 'chart' | 'table' | 'kpi';
    kpiMetric?: string;
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  items: DashboardItem[];
}

interface ReportData {
    kpiData?: any;
    chartData?: any[];
}

function DashboardElement({ item }: { item: DashboardItem }) {
    const [data, setData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Call the new, unsecured proxy route
                const response = await fetch('/api/dashboard-element-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.reportConfig),
                });
                if (!response.ok) throw new Error('Failed to fetch report data');
                const reportData = await response.json();
                setData(reportData);
            } catch (error) {
                console.error('Failed to load dashboard element data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [item]);

    if (isLoading) {
        return <div className="bg-gray-800 p-6 shadow rounded-lg h-96 animate-pulse"></div>;
    }

    if (!data) {
        return <div className="bg-gray-800 p-6 shadow rounded-lg"><p className="text-red-400">Failed to load data.</p></div>
    }

    switch (item.elementType) {
        case 'kpi':
            return <KpiCard title={item.kpiMetric?.replace(/_/g, ' ') || 'KPI'} value={data.kpiData ? data.kpiData[item.kpiMetric!] : '-'} />;
        case 'chart':
            return <Chart data={data.chartData || []} mode={item.reportConfig.reportFocus === 'segmentation' ? 'bar' : item.reportConfig.chartMode} config={item.reportConfig} />;
        case 'table':
            return <Table data={data.chartData || []} mode={item.reportConfig.reportFocus} config={item.reportConfig} />;
        default:
            return null;
    }
}


export default function DashboardPage() {
    const params = useParams();
    const id = params.id as string;
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddElementOpen, setIsAddElementOpen] = useState(false);

    const fetchDashboard = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/dashboards/${id}`);
            if (!response.ok) throw new Error('Failed to fetch dashboard');
            const data = await response.json();
            setDashboard(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [id]);

    const handleAddElement = async (reportConfig: any, elementType: 'kpi' | 'chart' | 'table', kpiMetric?: string) => {
        if (!dashboard) return;
        
        const newItem: DashboardItem = {
            id: Date.now().toString(),
            reportConfig,
            elementType,
            kpiMetric
        };
        
        const updatedItems = [...dashboard.items, newItem];
        
        try {
            await fetch(`/api/dashboards/${dashboard.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: updatedItems }),
            });
            fetchDashboard(); // Refresh dashboard to show the new element
        } catch (error) {
            console.error("Failed to add element to dashboard:", error);
        }
    };


    if (isLoading) {
        return <div className="p-8 text-white">Loading dashboard...</div>;
    }

    if (!dashboard) {
        return <div className="p-8 text-white">Dashboard not found.</div>;
    }

    return (
        <>
            <AddElementDialog
                open={isAddElementOpen}
                onOpenChange={setIsAddElementOpen}
                onElementSelect={handleAddElement}
            />
            <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">{dashboard.name}</h1>
                        {dashboard.description && <p className="text-gray-400">{dashboard.description}</p>}
                    </div>
                    <button onClick={() => setIsAddElementOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                        <PlusCircle size={16} />
                        Add Element
                    </button>
                </div>
                
                <div className="space-y-8">
                    {dashboard.items.length > 0 ? (
                        dashboard.items.map(item => (
                            <DashboardElement key={item.id} item={item} />
                        ))
                    ) : (
                        <div className="text-center py-16 bg-gray-800 rounded-lg">
                            <p className="text-gray-400">This dashboard is empty.</p>
                            <p className="text-sm text-gray-500 mt-2">Go to a report to add elements.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
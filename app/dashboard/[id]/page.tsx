// app/dashboard/[id]/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import KpiCard from '../../components/KpiCard';
import Chart from '../../components/Chart';
import Table from '../../components/Table';

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
                const response = await fetch('/api/report', {
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

    useEffect(() => {
        if (!id) return;
        const fetchDashboard = async () => {
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

        fetchDashboard();
    }, [id]);

    if (isLoading) {
        return <div className="p-8 text-white">Loading dashboard...</div>;
    }

    if (!dashboard) {
        return <div className="p-8 text-white">Dashboard not found.</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-white mb-2">{dashboard.name}</h1>
            {dashboard.description && <p className="text-gray-400 mb-8">{dashboard.description}</p>}
            
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
    );
}
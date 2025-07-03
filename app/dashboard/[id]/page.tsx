// app/dashboard/[id]/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import KpiCard from '../../components/KpiCard';
import Chart from '../../components/Chart';
import Table from '../../components/Table';
import { PlusCircle, Trash2, Edit, Check } from 'lucide-react';
import AddElementDialog from '../../components/AddElementDialog';
import RGL, { WidthProvider } from "react-grid-layout";

import "../../grid.css";

const GridLayout = WidthProvider(RGL);

interface DashboardItemLayout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
interface DashboardItem {
    id: string;
    reportConfig?: any;
    elementType: 'chart' | 'table' | 'kpi' | 'textbox';
    kpiMetric?: string;
    content?: string;
    layout: DashboardItemLayout;
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

function DashboardElement({ item, onRemove, onContentUpdate, isEditing, onEditToggle }: { 
    item: DashboardItem, 
    onRemove: (id: string) => void,
    onContentUpdate: (id: string, newContent: string) => void,
    isEditing: boolean,
    onEditToggle: (id: string | null) => void
}) {
    const [data, setData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [content, setContent] = useState(item.content || '');

    useEffect(() => {
        if (item.elementType !== 'textbox') {
            const fetchData = async () => {
                setIsLoading(true);
                try {
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
        } else {
            setIsLoading(false);
        }
    }, [item.reportConfig, item.elementType]);
    
    const handleSaveContent = () => {
        onContentUpdate(item.id, content);
        onEditToggle(null);
    }

    const renderContent = () => {
        if (isLoading) {
            return <div className="bg-gray-700 p-6 shadow rounded-lg h-full w-full animate-pulse"></div>;
        }

        if (item.elementType === 'textbox') {
            return isEditing ? (
                 <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSaveContent()}
                    className="w-full h-full bg-gray-900 text-white p-2 text-lg resize-none focus:outline-none"
                    autoFocus
                 />
            ) : (
                <div onDoubleClick={() => onEditToggle(item.id)} className="prose prose-invert p-2 text-lg w-full h-full cursor-pointer">{content || "Click to edit text..."}</div>
            );
        }

        if (!data) {
            return <div className="p-6 h-full w-full"><p className="text-red-400">Failed to load data.</p></div>
        }

        switch (item.elementType) {
            case 'kpi':
                return <KpiCard title={item.kpiMetric?.replace(/_/g, ' ')} value={data.kpiData ? data.kpiData[item.kpiMetric!] : '-'} />;
            case 'chart':
                return <Chart data={data.chartData || []} mode={item.reportConfig.reportFocus === 'segmentation' ? 'bar' : item.reportConfig.chartMode} config={item.reportConfig} />;
            case 'table':
                return <Table data={data.chartData || []} mode={item.reportConfig.reportFocus} config={item.reportConfig} />;
            default:
                return null;
        }
    };
    
    const handleEditMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isEditing) {
            handleSaveContent();
        } else {
            onEditToggle(item.id);
        }
    }

    const handleDeleteMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        onRemove(item.id);
    }

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg h-full w-full overflow-hidden flex flex-col group relative">
            <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
                {item.elementType === 'textbox' && (
                     <button onMouseDown={handleEditMouseDown} className="p-1 text-gray-400 bg-gray-900/50 rounded-full opacity-0 group-hover:opacity-100 hover:text-white transition-opacity">
                        {isEditing ? <Check size={14} /> : <Edit size={14}/>}
                    </button>
                )}
                <button onMouseDown={handleDeleteMouseDown} className="p-1 text-gray-400 bg-gray-900/50 rounded-full opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                    <Trash2 size={14}/>
                </button>
            </div>
            {renderContent()}
        </div>
    );
}


export default function DashboardPage() {
    const params = useParams();
    const id = params.id as string;
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddElementOpen, setIsAddElementOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const fetchDashboard = async () => {
        if (!id) return;
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
        setIsLoading(true);
        fetchDashboard();
    }, [id]);
    
    const updateDashboardItems = async (updatedItems: DashboardItem[]) => {
        if (!dashboard) return;
        try {
             await fetch(`/api/dashboards/${dashboard.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: updatedItems }),
            });
            setDashboard(prev => prev ? { ...prev, items: updatedItems } : null);
        } catch (error) {
            console.error("Failed to update dashboard items:", error);
            fetchDashboard();
        }
    };

    const handleLayoutChange = (layout: RGL.Layout[]) => {
        if (!dashboard || layout.length === 0) return;
        const updatedItems = dashboard.items.map(item => {
            const layoutItem = layout.find(l => l.i === item.id);
            if (layoutItem && JSON.stringify(item.layout) !== JSON.stringify(layoutItem)) {
                 return { ...item, layout: layoutItem };
            }
            return item;
        }).filter(item => item.layout);
        updateDashboardItems(updatedItems);
    }

    const handleAddElement = async (elementType: 'kpi' | 'chart' | 'table' | 'textbox', reportConfig?: any, kpiMetric?: string) => {
        if (!dashboard) return;
        
        const newItemId = Date.now().toString();
        let newItem: DashboardItem;

        if (elementType === 'textbox') {
            newItem = {
                id: newItemId,
                elementType: 'textbox',
                content: '## New Title\n\n- Add your text here',
                layout: { i: newItemId, x: 0, y: Infinity, w: 12, h: 2 }
            }
        } else {
             newItem = {
                id: newItemId,
                reportConfig,
                elementType,
                kpiMetric,
                layout: {
                    i: newItemId,
                    x: (dashboard.items.length * 4) % 12,
                    y: Infinity,
                    w: elementType === 'kpi' ? 4 : 8,
                    h: elementType === 'kpi' ? 2 : 8,
                }
            };
        }
        
        const updatedItems = [...dashboard.items, newItem];
        updateDashboardItems(updatedItems);
        setIsAddElementOpen(false);
    };
    
    const handleRemoveElement = (itemId: string) => {
        if (!dashboard) return;
        const updatedItems = dashboard.items.filter(item => item.id !== itemId);
        updateDashboardItems(updatedItems);
    };
    
    const handleUpdateElementContent = (itemId: string, newContent: string) => {
        if(!dashboard) return;
        const updatedItems = dashboard.items.map(item => item.id === itemId ? { ...item, content: newContent } : item);
        updateDashboardItems(updatedItems);
    };


    if (isLoading) {
        return <div className="p-8 text-white">Loading dashboard...</div>;
    }

    if (!dashboard) {
        return <div className="p-8 text-white">Dashboard not found.</div>;
    }
    
    const itemsWithLayout = dashboard.items.filter(item => item.layout);
    const layout = itemsWithLayout.map(item => item.layout);

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
                
                {itemsWithLayout.length > 0 ? (
                     <GridLayout
                        className="layout"
                        layout={layout}
                        cols={12}
                        rowHeight={30}
                        onLayoutChange={handleLayoutChange}
                        isDraggable={!editingItemId}
                        isResizable={!editingItemId}
                      >
                        {itemsWithLayout.map(item => (
                            <div key={item.id}>
                               <DashboardElement 
                                    item={item} 
                                    onRemove={handleRemoveElement} 
                                    onContentUpdate={handleUpdateElementContent}
                                    isEditing={editingItemId === item.id}
                                    onEditToggle={setEditingItemId}
                                />
                            </div>
                        ))}
                      </GridLayout>
                ) : (
                    <div className="text-center py-16 bg-gray-800 rounded-lg">
                        <p className="text-gray-400">This dashboard is empty.</p>
                        <p className="text-sm text-gray-500 mt-2">Go to a report to add elements.</p>
                    </div>
                )}
            </div>
        </>
    );
}
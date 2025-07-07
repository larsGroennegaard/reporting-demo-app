// app/components/Chart.tsx
"use client";

import { Bar, BarChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28"];

const formatYAxisTick = (tick: any) => { 
  if (typeof tick !== 'number') return tick;
  if (tick >= 1000000) return `${(tick / 1000000).toFixed(1)}M`;
  if (tick >= 1000) return `${(tick / 1000).toFixed(0)}K`;
  return String(Math.round(tick));
};

const formatTooltipValue = (value: any) => {
    if (typeof value !== 'number') return value;
    if (value % 1 !== 0) return value.toFixed(2);
    return new Intl.NumberFormat('en-US').format(value);
};


export default function Chart({ data, mode, config, title }: { data: any[], mode: string, config: any, title?: string }) {
  if (!data || data.length === 0) {
    return <div className="bg-gray-800 p-6 shadow rounded-lg h-96"><h3 className="text-lg font-semibold text-gray-100 mb-4">{title || 'Chart'}</h3><p className="text-gray-400">No data available.</p></div>
  }

  // Bar Chart for Segmentation Focus
  if (mode === 'bar') {
    const keys = config.chart?.metrics || [];
    return (
      <div className="bg-gray-800 p-6 shadow rounded-lg h-96">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">{title || 'Segmentation Breakdown'}</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
            <XAxis dataKey="segment" stroke="#A0AEC0" angle={-15} textAnchor="end" height={50} />
            <YAxis stroke="#A0AEC0" tickFormatter={formatYAxisTick}/>
            <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} labelStyle={{ color: '#E2E8F0' }} formatter={formatTooltipValue} />
            <Legend wrapperStyle={{ color: '#E2E8F0' }}/>
            {keys.map((key: string, index: number) => (
              <Bar key={key} dataKey={key} name={key.replace(/_/g, ' ')} fill={COLORS[index % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  
  // Line Chart for Time Series Focus
  const processLineChartData = () => {
    if (config.chart?.variant === 'time_series_segmented') {
        const pivotedData: { [key: string]: any } = {};
        const segments = new Set<string>();
        data.forEach(item => {
            const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            if (!pivotedData[month]) { pivotedData[month] = { month }; }
            const segmentName = item.segment || 'Unknown';
            pivotedData[month][segmentName] = item.value;
            segments.add(segmentName);
        });
        return { chartData: Object.values(pivotedData), keys: Array.from(segments) };
    } else { // time_series_line
        const keys = config.chart?.metrics || [];
        const chartData = data.map(row => ({ ...row, month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }));
        return { chartData, keys };
    }
  };

  const { chartData, keys } = processLineChartData();

  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg h-96">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">{title || 'Metric Over Time'}</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
          <XAxis dataKey="month" stroke="#A0AEC0" />
          <YAxis stroke="#A0AEC0" tickFormatter={formatYAxisTick} />
          <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} labelStyle={{ color: '#E2E8F0' }} formatter={formatTooltipValue} />
          <Legend wrapperStyle={{ color: '#E2E8F0' }}/>
          {keys.map((key: string, index: number) => (
            <Line key={key} type="monotone" dataKey={key} name={key.replace(/_/g, ' ')} stroke={COLORS[index % COLORS.length]} activeDot={{ r: 8 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
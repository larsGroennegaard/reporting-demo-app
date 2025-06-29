// app/components/Chart.tsx
"use client";

import { Bar, BarChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28"];

const formatYAxisTick = (tick: any) => { /* ... remains the same ... */ 
  if (typeof tick !== 'number') return tick;
  if (tick >= 1000000) return `${(tick / 1000000).toFixed(1)}M`;
  if (tick >= 1000) return `${(tick / 1000).toFixed(0)}K`;
  return String(tick);
};

// This function is no longer needed here, we'll move its logic to the components
// const processChartData = ...

export default function Chart({ data, mode, config }: { data: any[], mode: string, config: any }) {
  if (!data || data.length === 0) {
    return <div className="bg-gray-800 p-6 shadow rounded-lg h-96"><h3 className="text-lg font-semibold text-gray-100 mb-4">Chart</h3><p className="text-gray-400">No data available.</p></div>
  }

  // Bar Chart for Segmentation Focus
  if (mode === 'bar') {
    const keys = Object.keys(data[0] || {}).filter(key => key !== 'segment');
    return (
      <div className="bg-gray-800 p-6 shadow rounded-lg h-96">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Segmentation Breakdown</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
            <XAxis dataKey="segment" stroke="#A0AEC0" angle={-15} textAnchor="end" height={50} />
            <YAxis stroke="#A0AEC0" tickFormatter={formatYAxisTick}/>
            <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} labelStyle={{ color: '#E2E8F0' }} formatter={(value: any) => typeof value === 'number' ? formatYAxisTick(value) : value} />
            <Legend wrapperStyle={{ color: '#E2E8F0' }}/>
            {keys.map((key, index) => (
              <Bar key={key} dataKey={key} name={key.replace(/_/g, ' ')} fill={COLORS[index % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Line Chart for Time Series Focus (with its own data processing)
  const processLineChartData = () => {
    if (config.chartMode === 'single_segmented') {
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
    } else { // 'multi_metric'
      const keys = Object.keys(data[0] || {}).filter(key => key !== 'month');
      const chartData = data.map(row => ({ ...row, month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }));
      return { chartData, keys };
    }
  };

  const { chartData, keys } = processLineChartData();

  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg h-96">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Metric Over Time</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
          <XAxis dataKey="month" stroke="#A0AEC0" />
          <YAxis stroke="#A0AEC0" tickFormatter={formatYAxisTick} />
          <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} labelStyle={{ color: '#E2E8F0' }} formatter={(value: any) => typeof value === 'number' ? formatYAxisTick(value) : value} />
          <Legend wrapperStyle={{ color: '#E2E8F0' }}/>
          {keys.map((key, index) => (
            <Line key={key} type="monotone" dataKey={key} name={key} stroke={COLORS[index % COLORS.length]} activeDot={{ r: 8 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
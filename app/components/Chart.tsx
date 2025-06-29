// app/components/Chart.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28"];

// NEW: Helper function to format large numbers on the Y-Axis
const formatYAxisTick = (tick: number) => {
  if (tick >= 1000000) {
    return `${(tick / 1000000).toFixed(1)}M`;
  }
  if (tick >= 1000) {
    return `${(tick / 1000).toFixed(0)}K`;
  }
  return tick;
};

const processChartData = (data: any[], mode: string, config: any) => {
  // ... (this function remains the same)
  if (!data || data.length === 0) return { chartData: [], keys: [] };

  if (mode === 'single_segmented') {
    const pivotedData: { [key: string]: any } = {};
    const segments = new Set<string>();
    data.forEach(item => {
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!pivotedData[month]) {
        pivotedData[month] = { month };
      }
      const segmentName = item.segment || 'Unknown';
      pivotedData[month][segmentName] = item.value;
      segments.add(segmentName);
    });
    return { chartData: Object.values(pivotedData), keys: Array.from(segments) };
  } else {
    const keys = Object.keys(data[0] || {}).filter(key => key !== 'month');
    const chartData = data.map(row => ({
      ...row,
      month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    }));
    return { chartData, keys };
  }
};

export default function Chart({ data, mode, config }: { data: any[], mode: string, config: any }) {
  const { chartData, keys } = processChartData(data, mode, config);

  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg h-96">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Metric Over Time</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
          <XAxis dataKey="month" stroke="#A0AEC0" />
          {/* UPDATED: Added the tickFormatter to the YAxis */}
          <YAxis stroke="#A0AEC0" tickFormatter={formatYAxisTick} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} 
            labelStyle={{ color: '#E2E8F0' }}
            formatter={(value: number) => formatYAxisTick(value)}
          />
          <Legend wrapperStyle={{ color: '#E2E8F0' }}/>
          {keys.map((key, index) => (
            <Line key={key} type="monotone" dataKey={key} name={key} stroke={COLORS[index % COLORS.length]} activeDot={{ r: 8 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
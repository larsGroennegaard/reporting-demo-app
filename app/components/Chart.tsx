// app/components/Chart.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28"];

const processChartData = (data: any[], mode: string, config: any) => {
  if (!data || data.length === 0) return { chartData: [], keys: [] };

  if (mode === 'single_segmented') {
    const pivotedData: { [key: string]: any } = {};
    const segments = new Set<string>();

    data.forEach(item => {
      // THE FIX IS HERE: Changed item.month.value to just item.month
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!pivotedData[month]) {
        pivotedData[month] = { month };
      }
      // Ensure segment is not null before adding
      const segmentName = item.segment || 'Unknown';
      pivotedData[month][segmentName] = item.value;
      segments.add(segmentName);
    });

    return {
      chartData: Object.values(pivotedData),
      keys: Array.from(segments),
    };
  } else { // 'multi_metric' mode
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
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
          <XAxis dataKey="month" stroke="#A0AEC0" />
          <YAxis stroke="#A0AEC0" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} 
            labelStyle={{ color: '#E2E8F0' }}
          />
          <Legend wrapperStyle={{ color: '#E2E8F0' }}/>

          {keys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={COLORS[index % COLORS.length]}
              activeDot={{ r: 8 }}
              connectNulls // This will connect lines across any missing data points
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
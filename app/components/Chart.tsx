// app/components/Chart.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// The component now accepts a 'data' prop
export default function Chart({ data }: { data: any[] }) {
  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg h-96">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Metric Over Time</h3>
      <ResponsiveContainer width="100%" height="90%">
        {/* The chart now uses the 'data' prop */}
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
          {/* The X-axis now uses the 'month' key from our data */}
          <XAxis dataKey="month" stroke="#A0AEC0" />
          <YAxis stroke="#A0AEC0" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} 
            labelStyle={{ color: '#E2E8F0' }}
          />
          <Legend wrapperStyle={{ color: '#E2E8F0' }}/>
          {/* The Line now uses the 'value' key from our data */}
          <Line type="monotone" dataKey="value" name="Total Value" stroke="#8884d8" activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
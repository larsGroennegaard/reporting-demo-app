// app/components/Table.tsx
"use client";

// Helper function to pivot the data for the table
const processTableData = (data: any[], mode: string) => {
  if (!data || data.length === 0) return { tableHeaders: [], tableRows: [] };

  const pivoted: { [key: string]: any } = {};
  const months = new Set<string>();

  if (mode === 'single_segmented') {
    data.forEach(item => {
      const segment = item.segment || 'Unknown';
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months.add(month);

      if (!pivoted[segment]) {
        pivoted[segment] = { rowHeader: segment };
      }
      pivoted[segment][month] = item.value;
    });
    const tableHeaders = ['Segment', ...Array.from(months)];
    const tableRows = Object.values(pivoted);
    return { tableHeaders, tableRows };

  } else { // 'multi_metric' mode
    const metrics = Object.keys(data[0] || {}).filter(key => key !== 'month');
    metrics.forEach(metric => {
      pivoted[metric] = { rowHeader: metric };
    });

    data.forEach(item => {
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months.add(month);
      metrics.forEach(metric => {
        pivoted[metric][month] = item[metric];
      });
    });
    const tableHeaders = ['Metric', ...Array.from(months)];
    const tableRows = Object.values(pivoted);
    return { tableHeaders, tableRows };
  }
};

export default function Table({ data, mode }: { data: any[], mode: string }) {
  const { tableHeaders, tableRows } = processTableData(data, mode);

  if (tableRows.length === 0) {
    return (
        <div className="bg-gray-800 p-6 shadow rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100">Data Table</h3>
            <p className="text-gray-400 mt-2">No data available to display.</p>
        </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Data Table</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              {tableHeaders.map(header => (
                <th key={header} scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-white">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800">
            {tableRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {tableHeaders.map(header => (
                  <td key={`${rowIndex}-${header}`} className="whitespace-nowrap px-4 py-4 text-sm text-gray-300">
                    {/* Use the first header as the row header key */}
                    {header === tableHeaders[0] ? row.rowHeader : row[header] || 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
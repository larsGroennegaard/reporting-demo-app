// app/components/Table.tsx
"use client";

// This helper now handles three distinct modes
const processTableData = (data: any[], mode: string, config: any) => {
  if (!data || data.length === 0) return { tableHeaders: [], tableRows: [] };

  if (mode === 'segmentation') {
    const metrics = config.multiChartMetrics || [];
    const pivoted: { [key: string]: any } = {};
    
    // FIX: Added (metric: string) type annotation
    metrics.forEach((metric: string) => {
        pivoted[metric] = { rowHeader: metric.replace(/_/g, ' ') };
    });

    // FIX: Added (item: any) type annotation
    data.forEach((item: any) => {
        const segment = item.segment || 'Unknown';
        // FIX: Added (metric: string) type annotation
        metrics.forEach((metric: string) => {
            if (pivoted[metric]) {
                pivoted[metric][segment] = item[metric] || 0;
            }
        });
    });

    const segments = data.map(item => item.segment || 'Unknown');
    const tableHeaders = ['Metric', ...[...new Set(segments)]];
    const tableRows = Object.values(pivoted);
    return { tableHeaders, tableRows };
  } 
  
  // This is the original time_series pivot logic
  const pivoted: { [key: string]: any } = {};
  const timeUnits = new Set<string>();

  if (config.chartMode === 'single_segmented') {
    // FIX: Added (item: any) type annotation
    data.forEach((item: any) => {
      const segment = item.segment || 'Unknown';
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      timeUnits.add(month);
      if (!pivoted[segment]) { pivoted[segment] = { rowHeader: segment }; }
      pivoted[segment][month] = item.value;
    });
    const tableHeaders = ['Segment', ...Array.from(timeUnits)];
    return { tableHeaders, tableRows: Object.values(pivoted) };

  } else { // multi_metric
    const metrics = config.multiChartMetrics || [];
    // FIX: Added (metric: string) type annotation
    metrics.forEach((metric: string) => { pivoted[metric] = { rowHeader: metric.replace(/_/g, ' ') }; });
    // FIX: Added (item: any) type annotation
    data.forEach((item: any) => {
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      timeUnits.add(month);
      // FIX: Added (metric: string) type annotation
      metrics.forEach((metric: string) => {
        if (pivoted[metric]) { pivoted[metric][month] = item[metric] || 0; }
      });
    });
    const tableHeaders = ['Metric', ...Array.from(timeUnits)];
    return { tableHeaders, tableRows: Object.values(pivoted) };
  }
};

export default function Table({ data, mode, config }: { data: any[], mode: string, config: any }) {
  const { tableHeaders, tableRows } = processTableData(data, mode, config);

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
          <thead className="bg-gray-700"><tr>{tableHeaders.map(header => (<th key={header} scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-white">{header}</th>))}</tr></thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800">
            {tableRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {tableHeaders.map(header => (
                  <td key={`${rowIndex}-${header}`} className="whitespace-nowrap px-4 py-4 text-sm text-gray-300">
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
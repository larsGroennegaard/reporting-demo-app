// app/components/Table.tsx
"use client";

const formatTableCell = (value: any) => {
    if (typeof value !== 'number') return value;
    if (value % 1 !== 0) return value.toFixed(2);
    return new Intl.NumberFormat('en-US').format(value);
};

const processTableData = (data: any[], mode: string, config: any) => {
  if (!data || data.length === 0) return { tableHeaders: [], tableRows: [] };

  if (mode === 'segmentation') {
    const metrics = config.chart?.metrics || [];
    const pivoted: { [key: string]: any } = {};
    
    metrics.forEach((metric: string) => {
        pivoted[metric] = { rowHeader: metric.replace(/_/g, ' ') };
    });

    data.forEach((item: any) => {
        const segment = item.segment || 'Unknown';
        metrics.forEach((metric: string) => {
            if (pivoted[metric]) {
                pivoted[metric][segment] = item[metric] || 0;
            }
        });
    });

    const segments = data.map(item => item.segment || 'Unknown');
    const tableHeaders = ['Metric', ...Array.from(new Set(segments))];
    const tableRows = Object.values(pivoted);
    return { tableHeaders, tableRows };
  } 
  
  const pivoted: { [key: string]: any } = {};
  const timeUnits = new Set<string>();

  if (config.chart?.variant === 'time_series_segmented') {
    data.forEach((item: any) => {
      const segment = item.segment || 'Unknown';
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      timeUnits.add(month);
      if (!pivoted[segment]) { pivoted[segment] = { rowHeader: segment }; }
      pivoted[segment][month] = item.value;
    });
    const tableHeaders = ['Segment', ...Array.from(timeUnits)];
    return { tableHeaders, tableRows: Object.values(pivoted) };

  } else { // time_series_line
    const metrics = config.chart?.metrics || [];
    metrics.forEach((metric: string) => { pivoted[metric] = { rowHeader: metric.replace(/_/g, ' ') }; });
    data.forEach((item: any) => {
      const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      timeUnits.add(month);
      metrics.forEach((metric: string) => {
        if (pivoted[metric]) { pivoted[metric][month] = item[metric] || 0; }
      });
    });
    const tableHeaders = ['Metric', ...Array.from(timeUnits)];
    return { tableHeaders, tableRows: Object.values(pivoted) };
  }
};

export default function Table({ data, mode, config, title }: { data: any[], mode: string, config: any, title?: string }) {
  const { tableHeaders, tableRows } = processTableData(data, mode, config);

  if (tableRows.length === 0) {
    return (
        <div className="bg-gray-800 p-6 shadow rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100">{title || 'Data Table'}</h3>
            <p className="text-gray-400 mt-2">No data available to display.</p>
        </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">{title || 'Data Table'}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700"><tr>{tableHeaders.map(header => (<th key={header} scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-white">{header}</th>))}</tr></thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800">
            {tableRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {tableHeaders.map(header => (
                  <td key={`${rowIndex}-${header}`} className="whitespace-nowrap px-4 py-4 text-sm text-gray-300">
                    {header === tableHeaders[0] ? row.rowHeader : formatTableCell(row[header] || 0)}
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
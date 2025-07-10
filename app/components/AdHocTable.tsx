// app/components/AdHocTable.tsx
"use client";

// Handles BigQuery's specific object format for dates/timestamps
const formatTableCell = (value: any) => {
    if (value && typeof value === 'object' && value.value !== undefined) {
      return String(value.value);
    }
    if (typeof value === 'number') {
      if (value % 1 !== 0) return value.toFixed(2);
      return new Intl.NumberFormat('en-US').format(value);
    }
    return String(value);
};

export default function AdHocTable({ data, title }: { data: any[], title?: string }) {
  if (!data || data.length === 0) {
    return (
        <div className="bg-gray-800 p-6 shadow rounded-lg">
            <h3 className="text-lg font-semibold text-gray-100">{title || 'Query Results'}</h3>
            <p className="text-gray-400 mt-2">The query returned no results.</p>
        </div>
    );
  }

  const tableHeaders = Object.keys(data[0]);

  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">{title || 'Query Results'}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              {tableHeaders.map(header => (
                <th key={header} scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-white">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800">
            {data.map((row: any, rowIndex) => (
              <tr key={rowIndex}>
                {tableHeaders.map(header => (
                  <td key={`${rowIndex}-${header}`} className="whitespace-nowrap px-4 py-4 text-sm text-gray-300">
                     {formatTableCell(row[header])}
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
// app/components/Table.tsx
"use client";

export default function Table({ data }: { data: any[] }) {
  // If there's no data, display a message
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 p-6 shadow rounded-lg">
        <h3 className="text-lg font-semibold text-gray-100">Data Table</h3>
        <p className="text-gray-400 mt-2">No data available to display.</p>
      </div>
    );
  }

  // Get table headers automatically from the keys of the first object in the data array
  const headers = Object.keys(data[0]);

  return (
    <div className="bg-gray-800 p-6 shadow rounded-lg">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Data Table</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              {headers.map(header => (
                <th key={header} scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-white capitalize">
                  {/* Make header more readable if it's camelCase */}
                  {header.replace(/([A-Z])/g, ' $1').trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map(header => (
                  <td key={`${rowIndex}-${header}`} className="whitespace-nowrap px-4 py-4 text-sm text-gray-300">
                    {/* Display the value, ensuring it's a string */}
                    {String(row[header])}
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
// app/page.tsx
export default function HomePage() {
  return (
    <main className="flex h-screen bg-gray-100 font-sans">
      {/* Left Configuration Pane */}
      <div className="w-1/3 max-w-sm p-6 bg-white shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Report Configuration</h2>
        <p className="text-gray-600">Configuration controls will go here.</p>
        {/* Placeholder for future toggles and chat interface */}
      </div>

      {/* Right Report Canvas */}
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Your Report</h1>
        
        {/* Placeholders for the report elements */}
        <div className="space-y-8">
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="font-semibold text-gray-700">KPI Cards</p>
            <p className="text-gray-500 mt-2">Key Performance Indicators will be displayed here.</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="font-semibold text-gray-700">Chart</p>
            <p className="text-gray-500 mt-2">The line or bar chart will be displayed here.</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="font-semibold text-gray-700">Table</p>
            <p className="text-gray-500 mt-2">The data table will be displayed here.</p>
          </div>
        </div>

      </div>
    </main>
  );
}
// app/components/KpiCard.tsx

// We are defining the 'props' that this component accepts.
// For now, we'll use the 'any' type as a placeholder.
export default function KpiCard({ title, value }: { title: any, value: any }) {
  return (
    <div className="bg-white p-4 shadow rounded-lg text-center">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
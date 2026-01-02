'use client';

import { useAggregation } from '@/hooks/useContacts';

interface AggregationChartProps {
  field: string;
  title: string;
}

const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-red-500',
  'bg-orange-500',
];

/**
 * 집계 바 차트
 */
export function AggregationChart({ field, title }: AggregationChartProps) {
  const { data, isLoading } = useAggregation(field);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
        <div className="flex h-32 items-center justify-center text-gray-400">
          로딩 중...
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
        <div className="flex h-32 items-center justify-center text-gray-400">
          데이터 없음
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(...data.map((item) => item.count));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="space-y-2">
        {data.map((item, index) => {
          const percentage = ((item.count / total) * 100).toFixed(1);
          const barWidth = (item.count / maxCount) * 100;

          return (
            <div key={item.key} className="flex items-center gap-2">
              <span className="w-20 truncate text-xs text-gray-600">
                {item.key}
              </span>
              <div className="relative h-5 flex-1 rounded bg-gray-100">
                <div
                  className={`absolute left-0 top-0 h-full rounded ${COLORS[index % COLORS.length]}`}
                  style={{ width: `${barWidth}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-gray-700">
                  {item.count.toLocaleString()} ({percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-right text-xs text-gray-500">
        합계: {total.toLocaleString()}건
      </div>
    </div>
  );
}

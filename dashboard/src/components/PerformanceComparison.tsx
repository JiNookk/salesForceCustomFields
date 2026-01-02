'use client';

import { useState, useEffect, useRef } from 'react';

interface PerformanceComparisonProps {
  currentDataSource: 'mysql' | 'es';
  currentQueryTime: number;
  total?: number;
}

/**
 * MySQL vs Elasticsearch 성능 실시간 비교 카드
 */
export function PerformanceComparison({
  currentDataSource,
  currentQueryTime,
  total = 0,
}: PerformanceComparisonProps) {
  const [mysqlTime, setMysqlTime] = useState<number>(0);
  const [esTime, setEsTime] = useState<number>(0);
  const prevQueryTimeRef = useRef<number>(0);

  // 쿼리 시간이 변경되었을 때만 업데이트
  useEffect(() => {
    if (currentQueryTime > 0 && currentQueryTime !== prevQueryTimeRef.current) {
      prevQueryTimeRef.current = currentQueryTime;
      if (currentDataSource === 'mysql') {
        setMysqlTime(currentQueryTime);
      } else {
        setEsTime(currentQueryTime);
      }
    }
  }, [currentQueryTime, currentDataSource]);

  const mysqlIsSlower = mysqlTime > esTime;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          성능 벤치마크
        </h2>
        <span className="text-sm text-gray-500">
          {total.toLocaleString()}건
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* MySQL Card */}
        <div
          className={`rounded-lg p-4 transition-all ${
            currentDataSource === 'mysql'
              ? 'border-2 border-blue-500 bg-blue-50'
              : 'border border-gray-200 bg-gray-50'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">MySQL</p>
              <p className="text-xs text-gray-500">EAV 패턴</p>
            </div>
          </div>
          <div className="mt-3">
            <p
              className={`text-2xl font-bold ${
                mysqlIsSlower && mysqlTime > 0 ? 'text-red-600' : 'text-blue-600'
              }`}
            >
              {mysqlTime > 0 ? `${mysqlTime.toLocaleString()}ms` : '-'}
            </p>
          </div>
        </div>

        {/* ES Card */}
        <div
          className={`rounded-lg p-4 transition-all ${
            currentDataSource === 'es'
              ? 'border-2 border-green-500 bg-green-50'
              : 'border border-gray-200 bg-gray-50'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Elasticsearch</p>
              <p className="text-xs text-gray-500">비정규화</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-green-600">
              {esTime > 0 ? `${esTime.toLocaleString()}ms` : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="mt-4 rounded-lg bg-blue-50 p-3 text-center text-sm text-blue-700">
        검색이나 정렬을 사용해서 쿼리 성능을 비교해보세요
      </div>
    </div>
  );
}

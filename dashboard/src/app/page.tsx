'use client';

import { useState, useCallback } from 'react';
import type { SortingState } from '@tanstack/react-table';
import { useIsFetching } from '@tanstack/react-query';
import { useContacts, useCustomFields } from '@/hooks/useContacts';
import { ContactsTable } from '@/components/ContactsTable';
import { DataSourceToggle } from '@/components/DataSourceToggle';
import { SearchInput } from '@/components/SearchInput';
import { TablePagination } from '@/components/TablePagination';
import { AggregationChart } from '@/components/AggregationChart';
import { PerformanceComparison } from '@/components/PerformanceComparison';
import { StatCard } from '@/components/StatCard';

export default function DashboardPage() {
  // 상태 관리
  const [dataSource, setDataSource] = useState<'mysql' | 'es'>('es');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  // 정렬 상태를 API 포맷으로 변환
  const apiSort = sorting.map((s) => ({
    field: s.id,
    direction: s.desc ? ('desc' as const) : ('asc' as const),
  }));

  // 데이터 조회
  const { data: contactsData, isLoading } = useContacts({
    dataSource,
    page,
    pageSize,
    search: search || undefined,
    sort: apiSort.length > 0 ? apiSort : undefined,
  });

  const { data: customFields = [] } = useCustomFields();

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleDataSourceChange = useCallback((value: 'mysql' | 'es') => {
    setDataSource(value);
    setPage(1);
  }, []);

  const totalPages = contactsData
    ? Math.ceil(contactsData.total / pageSize)
    : 0;

  const isFetching = useIsFetching({ queryKey: ['contacts'] });

  return (
    <>
      {/* 글로벌 로딩 오버레이 */}
      {isFetching > 0 && (
        <>
          <div className="fixed inset-0 z-40 bg-gray-500/50" />
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-6 shadow-2xl">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <p className="text-sm font-medium text-slate-700">쿼리 실행 중...</p>
            </div>
          </div>
        </>
      )}
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 헤더 */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    EAV vs Elasticsearch 벤치마크
                  </h1>
                  <p className="text-sm text-slate-500">
                    실시간 성능 비교 대시보드
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* 현재 쿼리 시간 */}
              {contactsData && (
                <div className="hidden rounded-lg bg-slate-100 px-4 py-2 md:block">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        contactsData.queryTime < 100
                          ? 'bg-green-500'
                          : contactsData.queryTime < 500
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {contactsData.queryTime.toLocaleString()}ms
                    </span>
                  </div>
                </div>
              )}
              <DataSourceToggle
                value={dataSource}
                onChange={handleDataSourceChange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 통계 카드 그리드 */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="전체 레코드"
            value={contactsData?.total ?? 0}
            subtitle="데이터베이스 내 Contact 수"
            icon="database"
            variant="default"
          />
          <StatCard
            title="커스텀 필드"
            value={customFields.length}
            subtitle="동적 속성 개수"
            icon="chart"
            variant="default"
          />
          <StatCard
            title="현재 쿼리 시간"
            value={`${contactsData?.queryTime ?? 0}ms`}
            subtitle={dataSource === 'es' ? 'Elasticsearch' : 'MySQL EAV'}
            icon="clock"
            variant={
              contactsData?.queryTime && contactsData.queryTime > 500
                ? 'danger'
                : 'success'
            }
          />
          <StatCard
            title="전체 페이지"
            value={totalPages}
            subtitle={`페이지당 ${pageSize}개`}
            icon="storage"
            variant="default"
          />
        </div>

        {/* 성능 비교 + 집계 차트 */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 성능 비교 패널 */}
          <div className="lg:col-span-1">
            <PerformanceComparison
              currentDataSource={dataSource}
              currentQueryTime={contactsData?.queryTime ?? 0}
              total={contactsData?.total ?? 0}
            />
          </div>

          {/* 집계 차트들 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
            <AggregationChart field="tier__c" title="고객 등급" />
            <AggregationChart field="region__c" title="지역 분포" />
            <AggregationChart field="department__c" title="부서 분포" />
            <AggregationChart field="lead_source__c" title="리드 소스" />
          </div>
        </div>

        {/* 검색 & 필터 */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 sm:max-w-md">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="이름, 이메일로 검색..."
            />
          </div>

          <div className="flex items-center gap-3">
            {contactsData && (
              <>
                <span className="text-sm text-slate-500">
                  <span className="font-medium text-slate-700">
                    {((page - 1) * pageSize + 1).toLocaleString()}
                  </span>
                  {' - '}
                  <span className="font-medium text-slate-700">
                    {Math.min(page * pageSize, contactsData.total).toLocaleString()}
                  </span>
                  {' / '}
                  <span className="font-medium text-slate-700">
                    {contactsData.total.toLocaleString()}
                  </span>
                  건
                </span>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    dataSource === 'es'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {dataSource === 'es' ? 'Elasticsearch' : 'MySQL EAV'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 테이블 카드 */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ContactsTable
            data={contactsData?.data ?? []}
            customFields={customFields}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={isLoading}
          />

          {/* 페이지네이션 */}
          {contactsData && (
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={contactsData.total}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>

      </main>
    </div>
    </>
  );
}

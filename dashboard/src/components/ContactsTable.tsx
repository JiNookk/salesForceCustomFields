'use client';

import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import type { Contact, CustomFieldDefinition } from '@/types/contact';

interface ContactsTableProps {
  data: Contact[];
  customFields: CustomFieldDefinition[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  isLoading?: boolean;
}

const columnHelper = createColumnHelper<Contact>();

/**
 * Contact 목록 테이블
 */
export function ContactsTable({
  data,
  customFields,
  sorting,
  onSortingChange,
  isLoading,
}: ContactsTableProps) {
  // 컬럼 정의
  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor('name', {
        header: '이름',
        cell: (info) => (
          <span className="font-medium text-gray-900">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('email', {
        header: '이메일',
        cell: (info) => (
          <a
            href={`mailto:${info.getValue()}`}
            className="text-blue-600 hover:underline"
          >
            {info.getValue()}
          </a>
        ),
      }),
      columnHelper.accessor('createdAt', {
        header: '생성일',
        cell: (info) => new Date(info.getValue()).toLocaleDateString('ko-KR'),
      }),
    ];

    // 커스텀 필드 컬럼 추가
    const customFieldColumns = customFields
      .filter((field) => field.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((field) =>
        columnHelper.accessor(
          (row) => row.customFields[field.apiName] as string | number | null,
          {
            id: field.apiName,
            header: field.name,
            cell: (info) => {
              const value = info.getValue();
              if (value === null || value === undefined) return '-';

              if (field.fieldType === 'DATE' && value) {
                return new Date(String(value)).toLocaleDateString('ko-KR');
              }
              if (field.fieldType === 'NUMBER') {
                return Number(value).toLocaleString();
              }
              return String(value);
            },
          },
        ),
      );

    return [...baseColumns, ...customFieldColumns];
  }, [customFields]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(newSorting);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // 서버사이드 정렬
  });

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() && (
                        <span className="text-blue-600">
                          {header.column.getIsSorted() === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    로딩 중...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap px-4 py-3 text-sm text-gray-700"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

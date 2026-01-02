'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchContacts, fetchCustomFields, fetchAggregation } from '@/lib/api';
import type { ContactsRequest } from '@/types/contact';

/**
 * Contact 목록 조회 훅
 */
export function useContacts(params: ContactsRequest) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: () => fetchContacts(params),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 커스텀 필드 정의 조회 훅
 */
export function useCustomFields() {
  return useQuery({
    queryKey: ['customFields'],
    queryFn: fetchCustomFields,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 필드별 집계 조회 훅
 */
export function useAggregation(field: string) {
  return useQuery({
    queryKey: ['aggregation', field],
    queryFn: () => fetchAggregation(field),
    staleTime: 30 * 1000, // 30초
  });
}

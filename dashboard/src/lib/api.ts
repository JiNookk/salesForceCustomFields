/**
 * API 클라이언트
 */

import type {
  ContactsRequest,
  ContactsResponse,
  CustomFieldDefinition,
} from '@/types/contact';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Contact 목록 조회
 */
export async function fetchContacts(
  params: ContactsRequest,
): Promise<ContactsResponse> {
  const queryParams = new URLSearchParams();

  queryParams.set('dataSource', params.dataSource);
  queryParams.set('page', params.page.toString());
  queryParams.set('pageSize', params.pageSize.toString());

  if (params.search) {
    queryParams.set('search', params.search);
  }

  if (params.groupBy) {
    queryParams.set('groupBy', params.groupBy);
  }

  if (params.sort && params.sort.length > 0) {
    queryParams.set('sort', JSON.stringify(params.sort));
  }

  if (params.filter && params.filter.length > 0) {
    queryParams.set('filter', JSON.stringify(params.filter));
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/contacts/search?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 커스텀 필드 정의 목록 조회
 */
export async function fetchCustomFields(): Promise<CustomFieldDefinition[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/custom-fields`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 집계 결과 타입
 */
export interface AggregationItem {
  key: string;
  count: number;
}

/**
 * 필드별 집계 조회
 */
export async function fetchAggregation(field: string): Promise<AggregationItem[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/es/contacts/aggregate?field=${field}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  return response.json();
}

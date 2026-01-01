import { Controller, Get, Query } from '@nestjs/common';
import {
  ElasticsearchService,
  type SearchResult,
  type AggregationResult,
} from '../../../infrastructure/elasticsearch/elasticsearch.service';

/**
 * 검색 API 컨트롤러
 */
@Controller('api/v1/contacts/search')
export class SearchController {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  /**
   * Contact 검색
   * GET /api/v1/contacts/search
   *
   * Query Parameters:
   * - keyword: 검색어 (email, name, 커스텀 필드에서 검색)
   * - filter[fieldName]: 필터 조건 (예: filter[tier__c]=GOLD)
   * - sort[fieldName]: 정렬 (예: sort[createdAt]=desc)
   * - page: 페이지 번호 (기본: 1)
   * - size: 페이지 크기 (기본: 20)
   */
  @Get()
  async search(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query() query?: Record<string, string>,
  ): Promise<SearchResult> {
    // 필터 파싱
    const filters: Record<string, string | number> = {};
    const sort: Record<string, 'asc' | 'desc'> = {};

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (key.startsWith('filter[') && key.endsWith(']')) {
          const fieldName = key.slice(7, -1);
          filters[fieldName] = value;
        }
        if (key.startsWith('sort[') && key.endsWith(']')) {
          const fieldName = key.slice(5, -1);
          if (value === 'asc' || value === 'desc') {
            sort[fieldName] = value;
          }
        }
      }
    }

    return this.elasticsearchService.searchContacts({
      keyword,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: Object.keys(sort).length > 0 ? sort : undefined,
      page: page ? parseInt(page, 10) : 1,
      size: size ? parseInt(size, 10) : 20,
    });
  }

  /**
   * Contact 집계 (그루핑)
   * GET /api/v1/contacts/search/aggregate
   *
   * Query Parameters:
   * - field: 집계할 필드 (예: tier__c)
   * - size: 결과 개수 (기본: 10)
   */
  @Get('aggregate')
  async aggregate(
    @Query('field') field: string,
    @Query('size') size?: string,
  ): Promise<AggregationResult[]> {
    return this.elasticsearchService.aggregateContacts(
      field,
      size ? parseInt(size, 10) : 10,
    );
  }
}

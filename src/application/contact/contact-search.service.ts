import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, type QueryRunner, type SelectQueryBuilder } from 'typeorm';
import {
  ElasticsearchService,
  type EsFilterCondition,
} from '../../infrastructure/elasticsearch/elasticsearch.service';
import type {
  SearchContactsDto,
  SearchContactsResponse,
  ContactResponse,
} from './dto/searchContacts.dto';
import { ContactEntity } from '../../infrastructure/persistence/typeorm/entity/contact.entity';
import { FieldValueEntity } from '../../infrastructure/persistence/typeorm/entity/fieldValue.entity';
import { FieldDefinitionEntity } from '../../infrastructure/persistence/typeorm/entity/fieldDefinition.entity';

/**
 * Contact 검색 서비스
 * - MySQL (EAV) vs Elasticsearch 성능 비교용
 * - 쿼리 시간 측정
 * - Salesforce 스타일 엔티티 (field_definitions, field_values) 사용
 */
@Injectable()
export class ContactSearchService {
  private readonly logger = new Logger(ContactSearchService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(ElasticsearchService)
    private readonly esService: ElasticsearchService,
  ) {}

  /**
   * Contact 검색 (MySQL 또는 ES)
   */
  async search(dto: SearchContactsDto): Promise<SearchContactsResponse> {
    const startTime = Date.now();

    let result: SearchContactsResponse;

    if (dto.dataSource === 'es') {
      result = await this.searchWithEs(dto);
    } else {
      result = await this.searchWithMySql(dto);
    }

    const queryTime = Date.now() - startTime;
    const totalPages = Math.ceil(result.total / dto.pageSize);

    return {
      ...result,
      queryTime,
      totalPages,
    };
  }

  /**
   * Elasticsearch 검색
   */
  private async searchWithEs(
    dto: SearchContactsDto,
  ): Promise<SearchContactsResponse> {
    const sort: Record<string, 'asc' | 'desc'> = {};
    if (dto.sort && dto.sort.length > 0) {
      for (const s of dto.sort) {
        sort[s.field] = s.direction;
      }
    }

    // 필터 변환 (다양한 연산자 지원)
    const filterConditions = this.buildEsFilters(dto.filter);

    const result = await this.esService.searchContactsAdvanced({
      keyword: dto.search,
      filterConditions,
      sort: Object.keys(sort).length > 0 ? sort : undefined,
      page: dto.page,
      size: dto.pageSize,
    });

    // 그루핑 처리
    let groups: { key: string; count: number }[] | undefined;
    if (dto.groupBy) {
      const aggResult = await this.esService.aggregateContacts(dto.groupBy, 50);
      groups = aggResult.map((r) => ({ key: r.key, count: r.count }));
    }

    return {
      data: result.data.map((item) => ({
        id: item.id,
        email: item.email,
        name: item.name,
        customFields: item.customFields,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total: result.total,
      page: dto.page,
      pageSize: dto.pageSize,
      totalPages: Math.ceil(result.total / dto.pageSize),
      queryTime: 0, // 나중에 채워짐
      dataSource: 'es',
      groups,
    };
  }

  /**
   * ES 필터 조건 빌드
   */
  private buildEsFilters(
    filters?: SearchContactsDto['filter'],
  ): EsFilterCondition[] {
    if (!filters || filters.length === 0) return [];

    return filters.map((f) => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
    }));
  }

  /**
   * MySQL 검색 (EAV 패턴 - 느림)
   * 커스텀 필드 정렬은 EAV 피벗으로 처리 (매우 느림!)
   */
  private async searchWithMySql(
    dto: SearchContactsDto,
  ): Promise<SearchContactsResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // 커스텀 필드 정렬이 필요한지 확인
      const customFieldSorts =
        dto.sort?.filter((s) => s.field.endsWith('__c')) || [];
      const hasCustomFieldSort = customFieldSorts.length > 0;

      // 그루핑이 필요한지 확인
      const needsGroupBy = dto.groupBy && dto.groupBy.endsWith('__c');

      let data: ContactResponse[];
      let total: number;
      let groups: { key: string; count: number }[] | undefined;

      if (hasCustomFieldSort || needsGroupBy) {
        // EAV 피벗 쿼리 사용 (느림!)
        const result = await this.searchWithMySqlPivot(dto, queryRunner);
        data = result.data;
        total = result.total;
        groups = result.groups;
      } else {
        // 기본 쿼리 (빠름)
        const result = await this.searchWithMySqlBasic(dto, queryRunner);
        data = result.data;
        total = result.total;
      }

      return {
        data,
        total,
        page: dto.page,
        pageSize: dto.pageSize,
        totalPages: Math.ceil(total / dto.pageSize),
        queryTime: 0,
        dataSource: 'mysql',
        groups,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * MySQL 기본 검색 (커스텀 필드 정렬 없음)
   * 최적화: Contact 먼저 조회 후, 해당 Contact의 fieldValues만 별도 조회
   */
  private async searchWithMySqlBasic(
    dto: SearchContactsDto,
    queryRunner: QueryRunner,
  ): Promise<{ data: ContactResponse[]; total: number }> {
    // 1단계: Contact만 조회 (fieldValues JOIN 없이)
    let qb: SelectQueryBuilder<ContactEntity> =
      queryRunner.manager.createQueryBuilder(ContactEntity, 'c');

    // 검색 조건 (firstName + lastName 조합)
    if (dto.search) {
      qb = qb.andWhere(
        "(CONCAT(c.firstName, ' ', c.lastName) LIKE :search OR c.email LIKE :search)",
        { search: `%${dto.search}%` },
      );
    }

    // 커스텀 필드 필터 (EAV 패턴으로 서브쿼리 필요 - 느림)
    if (dto.filter && dto.filter.length > 0) {
      for (let i = 0; i < dto.filter.length; i++) {
        const filter = dto.filter[i];
        if (filter.field.endsWith('__c')) {
          const subQuery: SelectQueryBuilder<FieldValueEntity> =
            queryRunner.manager
              .createQueryBuilder(FieldValueEntity, `fv${i}`)
              .innerJoin(
                FieldDefinitionEntity,
                `fd${i}`,
                `fd${i}.id = fv${i}.fieldId`,
              )
              .where(`fv${i}.recordId = c.id`)
              .andWhere(`fd${i}.apiName = :apiName${i}`, {
                [`apiName${i}`]: filter.field,
              });

          if (filter.operator === 'eq') {
            subQuery.andWhere(`fv${i}.value = :value${i}`, {
              [`value${i}`]: filter.value,
            });
          }

          qb = qb.andWhere(`EXISTS (${subQuery.getQuery()})`);
          qb.setParameters(subQuery.getParameters());
        }
      }
    }

    const total = await qb.getCount();

    // 정렬 (기본 필드만)
    if (dto.sort && dto.sort.length > 0) {
      for (const s of dto.sort) {
        if (!s.field.endsWith('__c')) {
          qb = qb.addOrderBy(
            `c.${s.field}`,
            s.direction.toUpperCase() as 'ASC' | 'DESC',
          );
        }
      }
    } else {
      qb = qb.addOrderBy('c.createdAt', 'DESC');
    }

    const offset = (dto.page - 1) * dto.pageSize;
    qb = qb.skip(offset).take(dto.pageSize);

    const contacts = await qb.getMany();

    // 2단계: 해당 Contact들의 fieldValues만 별도 조회 (최대 20개 × 10필드 = 200행)
    if (contacts.length > 0) {
      const contactIds = contacts.map((c) => c.id);
      const fieldValues = await queryRunner.manager
        .createQueryBuilder(FieldValueEntity, 'fv')
        .where('fv.recordId IN (:...contactIds)', { contactIds })
        .getMany();

      // fieldValues를 contact에 매핑
      const fieldValueMap = new Map<string, FieldValueEntity[]>();
      for (const fv of fieldValues) {
        const existing = fieldValueMap.get(fv.recordId) || [];
        existing.push(fv);
        fieldValueMap.set(fv.recordId, existing);
      }

      for (const contact of contacts) {
        contact.fieldValues = fieldValueMap.get(contact.id) || [];
      }
    }

    return {
      data: await this.transformContacts(contacts, queryRunner),
      total,
    };
  }

  /**
   * MySQL EAV 피벗 검색 (커스텀 필드 정렬/그루핑 지원 - 매우 느림!)
   * 이 쿼리는 ES와 비교하기 위한 것으로, 실제로는 매우 느립니다.
   */
  private async searchWithMySqlPivot(
    dto: SearchContactsDto,
    queryRunner: QueryRunner,
  ): Promise<{
    data: ContactResponse[];
    total: number;
    groups?: { key: string; count: number }[];
  }> {
    // 1. 사용 중인 커스텀 필드 정의 로드
    const definitions = await queryRunner.manager.find(FieldDefinitionEntity);

    // 2. 피벗 SELECT 절 생성 (단일 value 컬럼 사용)
    const pivotSelects = definitions.map((def) => {
      const alias = def.apiName;
      return `MAX(CASE WHEN fd.api_name = '${def.apiName}' THEN fv.value END) as \`${alias}\``;
    });

    // 3. WHERE 절 생성
    const whereConditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (dto.search) {
      whereConditions.push(
        "(CONCAT(c.first_name, ' ', c.last_name) LIKE :search OR c.email LIKE :search)",
      );
      params.search = `%${dto.search}%`;
    }

    // 4. HAVING 절 (커스텀 필드 필터)
    const havingConditions: string[] = [];
    if (dto.filter && dto.filter.length > 0) {
      for (let i = 0; i < dto.filter.length; i++) {
        const filter = dto.filter[i];
        if (filter.field.endsWith('__c')) {
          const def = definitions.find((d) => d.apiName === filter.field);
          if (def) {
            if (filter.operator === 'eq') {
              havingConditions.push(
                `MAX(CASE WHEN fd.api_name = :apiName${i} THEN fv.value END) = :value${i}`,
              );
              params[`apiName${i}`] = filter.field;
              params[`value${i}`] = filter.value;
            }
          }
        } else {
          // 기본 필드 필터
          whereConditions.push(`c.${filter.field} = :value${i}`);
          params[`value${i}`] = filter.value;
        }
      }
    }

    // 5. ORDER BY 절 (커스텀 필드 포함)
    const orderByParts: string[] = [];
    if (dto.sort && dto.sort.length > 0) {
      for (const s of dto.sort) {
        if (s.field.endsWith('__c')) {
          orderByParts.push(`\`${s.field}\` ${s.direction.toUpperCase()}`);
        } else {
          orderByParts.push(`c.${s.field} ${s.direction.toUpperCase()}`);
        }
      }
    } else {
      orderByParts.push('c.created_at DESC');
    }

    // 6. Raw SQL 쿼리 생성 (Salesforce 스타일 테이블명)
    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
    const havingClause =
      havingConditions.length > 0
        ? `HAVING ${havingConditions.join(' AND ')}`
        : '';
    const orderByClause = `ORDER BY ${orderByParts.join(', ')}`;

    const offset = (dto.page - 1) * dto.pageSize;

    const sql = `
      SELECT
        c.id, c.email, CONCAT(c.first_name, ' ', c.last_name) as name,
        c.created_at as createdAt, c.updated_at as updatedAt
        ${pivotSelects.length > 0 ? ', ' + pivotSelects.join(', ') : ''}
      FROM contacts c
      LEFT JOIN custom_field_values fv ON fv.record_id = c.id
      LEFT JOIN custom_field_definitions fd ON fd.id = fv.field_id
      ${whereClause}
      GROUP BY c.id
      ${havingClause}
      ${orderByClause}
      LIMIT ${dto.pageSize} OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(*) as cnt FROM (
        SELECT c.id
        FROM contacts c
        LEFT JOIN custom_field_values fv ON fv.record_id = c.id
        LEFT JOIN custom_field_definitions fd ON fd.id = fv.field_id
        ${whereClause}
        GROUP BY c.id
        ${havingClause}
      ) as sub
    `;

    // Raw SQL 결과 타입 정의
    interface RawContactRow {
      id: string;
      email: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      [key: string]: string | number | Date | null;
    }
    interface CountRow {
      cnt: string;
    }
    interface GroupRow {
      groupKey: string | null;
      cnt: string;
    }

    // 쿼리 실행
    const rawResults: RawContactRow[] = await queryRunner.manager.query(
      sql,
      Object.values(params),
    );
    const countResult: CountRow[] = await queryRunner.manager.query(
      countSql,
      Object.values(params),
    );
    const total = parseInt(countResult[0]?.cnt || '0', 10);

    // 그루핑 처리
    let groups: { key: string; count: number }[] | undefined;
    if (dto.groupBy) {
      const groupByExpr = dto.groupBy.endsWith('__c')
        ? `MAX(CASE WHEN fd.api_name = '${dto.groupBy}' THEN fv.value END)`
        : `c.${dto.groupBy}`;
      const groupSql = `
        SELECT
          ${groupByExpr} as groupKey,
          COUNT(DISTINCT c.id) as cnt
        FROM contacts c
        LEFT JOIN custom_field_values fv ON fv.record_id = c.id
        LEFT JOIN custom_field_definitions fd ON fd.id = fv.field_id
        ${whereClause}
        GROUP BY ${groupByExpr}
        ORDER BY cnt DESC
        LIMIT 50
      `;
      const groupResults: GroupRow[] = await queryRunner.manager.query(
        groupSql,
        Object.values(params),
      );
      groups = groupResults.map((r) => ({
        key: r.groupKey || 'null',
        count: parseInt(r.cnt, 10),
      }));
    }

    // Response 변환
    const data: ContactResponse[] = rawResults.map((row) => {
      const customFields: Record<string, string | number | Date | null> = {};
      for (const def of definitions) {
        if (row[def.apiName] !== undefined) {
          customFields[def.apiName] = row[def.apiName];
        }
      }
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        customFields,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return { data, total, groups };
  }

  /**
   * Contact 엔티티를 Response로 변환
   */
  private async transformContacts(
    contacts: ContactEntity[],
    queryRunner: QueryRunner,
  ): Promise<ContactResponse[]> {
    const definitionIds = new Set<string>();
    for (const contact of contacts) {
      for (const fv of contact.fieldValues || []) {
        definitionIds.add(fv.fieldId);
      }
    }

    const definitions =
      definitionIds.size > 0
        ? await queryRunner.manager.find(FieldDefinitionEntity, {
            where: Array.from(definitionIds).map((id) => ({ id })),
          })
        : [];

    const defMap = new Map(definitions.map((d) => [d.id, d]));

    return contacts.map((contact) => {
      const customFields: Record<string, string | number | Date | null> = {};

      for (const fv of contact.fieldValues || []) {
        const def = defMap.get(fv.fieldId);
        if (def) {
          customFields[def.apiName] = fv.value;
        }
      }

      // firstName + lastName -> name 조합
      const fullName = `${contact.firstName} ${contact.lastName}`.trim();

      return {
        id: contact.id,
        email: contact.email ?? '',
        name: fullName,
        customFields,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      };
    });
  }
}

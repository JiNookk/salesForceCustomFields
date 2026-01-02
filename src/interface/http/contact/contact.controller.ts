import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContactService } from '../../../application/contact/contact.service';
import { ContactSearchService } from '../../../application/contact/contact-search.service';
import type { CreateContactDto } from '../../../application/contact/dto/createContact.dto';
import type { UpdateContactDto } from '../../../application/contact/dto/updateContact.dto';
import type { Contact } from '../../../domain/contact/contact.domain';

/**
 * Contact REST API 컨트롤러
 */
@Controller('api/v1/contacts')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly contactSearchService: ContactSearchService,
  ) {}

  /**
   * Contact 검색 (MySQL/ES 성능 비교용)
   * GET /api/v1/contacts/search
   */
  @Get('search')
  async search(
    @Query('dataSource') dataSource: 'mysql' | 'es' = 'es',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search?: string,
    @Query('sort') sortJson?: string,
    @Query('filter') filterJson?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    type SortItem = { field: string; direction: 'asc' | 'desc' };
    type FilterItem = {
      field: string;
      operator: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'between';
      value: string | number | [number, number];
    };

    const sort: SortItem[] | undefined = sortJson
      ? (JSON.parse(sortJson) as SortItem[])
      : undefined;
    const filter: FilterItem[] | undefined = filterJson
      ? (JSON.parse(filterJson) as FilterItem[])
      : undefined;

    return this.contactSearchService.search({
      dataSource,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      search,
      sort,
      filter,
      groupBy,
    });
  }

  /**
   * Contact 생성
   * POST /api/v1/contacts
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateContactDto) {
    const contact = await this.contactService.create(dto);
    return this.toResponse(contact);
  }

  // findAll() 삭제됨 - 500K 레코드를 한번에 로드하면 메모리 크래시 발생
  // 대신 /api/v1/contacts/search 사용

  /**
   * Contact 상세 조회
   * GET /api/v1/contacts/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    const contact = await this.contactService.findById(id);
    return this.toResponse(contact);
  }

  /**
   * Contact 수정
   * PATCH /api/v1/contacts/:id
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    const contact = await this.contactService.update(id, dto);
    return this.toResponse(contact);
  }

  /**
   * Contact 삭제
   * DELETE /api/v1/contacts/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.contactService.delete(id);
  }

  /**
   * Domain -> Response DTO 변환
   */
  private toResponse(contact: Contact) {
    // 커스텀 필드 값을 { apiName: value } 형태로 변환
    const customFields: Record<string, string | number | Date | null> = {};
    for (const fieldValue of contact.customFieldValues) {
      customFields[fieldValue.fieldDefinition.apiName] = fieldValue.getValue();
    }

    return {
      id: contact.id,
      email: contact.email,
      name: contact.name,
      customFields,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }
}

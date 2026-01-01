import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContactService } from '../../../application/contact/contact.service';
import type { CreateContactDto } from '../../../application/contact/dto/createContact.dto';
import type { UpdateContactDto } from '../../../application/contact/dto/updateContact.dto';
import type { Contact } from '../../../domain/contact/contact.domain';

/**
 * Contact REST API 컨트롤러
 */
@Controller('api/v1/contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

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

  /**
   * Contact 목록 조회
   * GET /api/v1/contacts
   */
  @Get()
  async findAll() {
    const contacts = await this.contactService.findAll();
    return contacts.map((contact) => this.toResponse(contact));
  }

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

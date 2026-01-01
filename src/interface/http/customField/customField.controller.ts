import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomFieldDefinitionService } from '../../../application/customField/customFieldDefinition.service';
import { CreateCustomFieldRequest } from '../../dto/customField/createCustomField.request';
import { CustomFieldResponse } from '../../dto/customField/customField.response';

/**
 * 커스텀 필드 정의 API
 */
@Controller('api/v1/custom-fields')
export class CustomFieldController {
  constructor(private readonly service: CustomFieldDefinitionService) {}

  /**
   * 커스텀 필드 생성
   * POST /api/v1/custom-fields
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() request: CreateCustomFieldRequest,
  ): Promise<CustomFieldResponse> {
    const definition = await this.service.create({
      name: request.name,
      apiName: request.apiName,
      fieldType: request.fieldType,
      options: request.options,
      isRequired: request.isRequired,
    });
    return CustomFieldResponse.from(definition);
  }

  /**
   * 커스텀 필드 목록 조회
   * GET /api/v1/custom-fields
   */
  @Get()
  async findAll(): Promise<CustomFieldResponse[]> {
    const definitions = await this.service.findAllActive();
    return definitions.map((definition) =>
      CustomFieldResponse.from(definition),
    );
  }

  /**
   * 커스텀 필드 상세 조회
   * GET /api/v1/custom-fields/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<CustomFieldResponse> {
    const definition = await this.service.findById(id);
    return CustomFieldResponse.from(definition);
  }

  /**
   * 커스텀 필드 비활성화 (소프트 삭제)
   * DELETE /api/v1/custom-fields/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param('id') id: string): Promise<void> {
    await this.service.deactivate(id);
  }
}

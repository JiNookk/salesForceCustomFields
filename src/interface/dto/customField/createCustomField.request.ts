import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { FieldType } from '../../../domain/customField/fieldType.vo';

/**
 * 커스텀 필드 생성 Request DTO
 */
export class CreateCustomFieldRequest {
  @IsString()
  name: string;

  @IsString()
  apiName: string;

  @IsEnum(FieldType)
  fieldType: FieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

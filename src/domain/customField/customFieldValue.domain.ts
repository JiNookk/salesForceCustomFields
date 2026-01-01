import { CustomFieldDefinition } from './customFieldDefinition.domain';
import { FieldType } from './fieldType.vo';

export interface CreateFieldValueArgs {
  id: string;
  fieldDefinition: CustomFieldDefinition;
  value: string | number | Date;
}

/**
 * 커스텀 필드 값 도메인
 * - EAV 패턴의 Value 부분
 * - 타입별로 별도 컬럼에 값 저장
 */
export class CustomFieldValue {
  private constructor(
    private readonly _id: string,
    private readonly _fieldDefinition: CustomFieldDefinition,
    private _valueText: string | null,
    private _valueNumber: number | null,
    private _valueDate: Date | null,
    private _valueSelect: string | null,
  ) {}

  /**
   * 커스텀 필드 값 생성
   * @throws 값이 필드 정의에 맞지 않는 경우
   */
  static create(args: CreateFieldValueArgs): CustomFieldValue {
    const { id, fieldDefinition, value } = args;

    // 필드 정의로 값 검증
    const validationValue =
      value instanceof Date ? value.toISOString().split('T')[0] : value;
    const validation = fieldDefinition.validateValue(validationValue);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 타입별 값 분배
    let valueText: string | null = null;
    let valueNumber: number | null = null;
    let valueDate: Date | null = null;
    let valueSelect: string | null = null;

    if (value !== null && value !== undefined) {
      switch (fieldDefinition.fieldType) {
        case FieldType.TEXT:
          valueText = value as string;
          break;
        case FieldType.NUMBER:
          valueNumber = value as number;
          break;
        case FieldType.DATE:
          valueDate = value instanceof Date ? value : new Date(value as string);
          break;
        case FieldType.SELECT:
          valueSelect = value as string;
          break;
      }
    }

    return new CustomFieldValue(
      id,
      fieldDefinition,
      valueText,
      valueNumber,
      valueDate,
      valueSelect,
    );
  }

  /**
   * 값 업데이트
   * @throws 값이 필드 정의에 맞지 않는 경우
   */
  updateValue(newValue: string | number | Date): void {
    const validationValue =
      newValue instanceof Date
        ? newValue.toISOString().split('T')[0]
        : newValue;
    const validation = this._fieldDefinition.validateValue(validationValue);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 기존 값 초기화
    this._valueText = null;
    this._valueNumber = null;
    this._valueDate = null;
    this._valueSelect = null;

    // 새 값 설정
    if (newValue !== null && newValue !== undefined) {
      switch (this._fieldDefinition.fieldType) {
        case FieldType.TEXT:
          this._valueText = newValue as string;
          break;
        case FieldType.NUMBER:
          this._valueNumber = newValue as number;
          break;
        case FieldType.DATE:
          this._valueDate =
            newValue instanceof Date ? newValue : new Date(newValue as string);
          break;
        case FieldType.SELECT:
          this._valueSelect = newValue as string;
          break;
      }
    }
  }

  /**
   * 현재 값 반환 (타입에 따라)
   */
  getValue(): string | number | Date | null {
    switch (this._fieldDefinition.fieldType) {
      case FieldType.TEXT:
        return this._valueText;
      case FieldType.NUMBER:
        return this._valueNumber;
      case FieldType.DATE:
        return this._valueDate;
      case FieldType.SELECT:
        return this._valueSelect;
      default:
        return null;
    }
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get fieldDefinition(): CustomFieldDefinition {
    return this._fieldDefinition;
  }

  get fieldType(): FieldType {
    return this._fieldDefinition.fieldType;
  }
}

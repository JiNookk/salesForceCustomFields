import { FieldType } from './fieldType.vo';

export interface CreateFieldDefinitionArgs {
  id: string;
  name: string;
  apiName: string;
  fieldType: FieldType;
  options?: string[];
  isRequired?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 커스텀 필드 정의 도메인
 * - 필드의 메타데이터를 관리 (이름, 타입, 옵션 등)
 * - 값 검증 로직 포함
 */
export class CustomFieldDefinition {
  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _apiName: string,
    private readonly _fieldType: FieldType,
    private readonly _options: string[],
    private readonly _isRequired: boolean,
    private _isActive: boolean,
    private _displayOrder: number,
  ) {}

  /**
   * 커스텀 필드 정의 생성
   * @throws apiName 형식이 잘못된 경우
   * @throws SELECT 타입인데 options가 없는 경우
   */
  static create(args: CreateFieldDefinitionArgs): CustomFieldDefinition {
    // API 이름 규칙 검증: 영문 소문자로 시작, 소문자+숫자+언더스코어 허용, __c로 끝남
    if (!/^[a-z][a-z0-9_]*__c$/.test(args.apiName)) {
      throw new Error('API 이름은 영문 소문자로 시작하고 __c로 끝나야 합니다');
    }

    // SELECT 타입이면 options 필수
    if (args.fieldType === FieldType.SELECT) {
      if (!args.options || args.options.length === 0) {
        throw new Error('SELECT 타입은 최소 1개 이상의 옵션이 필요합니다');
      }
    }

    return new CustomFieldDefinition(
      args.id,
      args.name,
      args.apiName,
      args.fieldType,
      args.options ?? [],
      args.isRequired ?? false,
      true,
      0,
    );
  }

  /**
   * 값 검증
   * @param value 검증할 값
   * @returns 검증 결과 (valid, error)
   */
  validateValue(value: unknown): ValidationResult {
    // null/undefined 체크
    if (value === null || value === undefined) {
      if (this._isRequired) {
        return { valid: false, error: `${this._name}은(는) 필수 항목입니다` };
      }
      return { valid: true };
    }

    // 타입별 검증
    switch (this._fieldType) {
      case FieldType.TEXT:
        if (typeof value !== 'string') {
          return { valid: false, error: '텍스트 형식이어야 합니다' };
        }
        break;

      case FieldType.NUMBER:
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: '숫자 형식이어야 합니다' };
        }
        break;

      case FieldType.DATE:
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return { valid: false, error: 'YYYY-MM-DD 형식이어야 합니다' };
        }
        break;

      case FieldType.SELECT:
        if (!this._options.includes(value as string)) {
          return {
            valid: false,
            error: `허용된 값: ${this._options.join(', ')}`,
          };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * 필드 비활성화
   */
  deactivate(): void {
    this._isActive = false;
  }

  /**
   * 필드 활성화
   */
  activate(): void {
    this._isActive = true;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get apiName(): string {
    return this._apiName;
  }

  get fieldType(): FieldType {
    return this._fieldType;
  }

  get options(): readonly string[] {
    return this._options;
  }

  get isRequired(): boolean {
    return this._isRequired;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get displayOrder(): number {
    return this._displayOrder;
  }
}

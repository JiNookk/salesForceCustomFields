import { CustomFieldDefinition } from '../customField/customFieldDefinition.domain';
import { CustomFieldValue } from '../customField/customFieldValue.domain';

export interface CreateContactArgs {
  id: string;
  email: string;
  name: string;
}

/**
 * Contact(고객) 도메인
 * - 기본 정보(email, name) 관리
 * - 커스텀 필드 값 관리
 */
export class Contact {
  private readonly _customFieldValues: Map<string, CustomFieldValue>;

  private constructor(
    private readonly _id: string,
    private readonly _email: string,
    private _name: string,
  ) {
    this._customFieldValues = new Map();
  }

  /**
   * Contact 생성
   * @throws 이메일 형식이 잘못된 경우
   * @throws 이름이 비어있는 경우
   */
  static create(args: CreateContactArgs): Contact {
    // 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
      throw new Error('유효한 이메일 형식이 아닙니다');
    }

    // 이름 검증
    const trimmedName = args.name?.trim() ?? '';
    if (trimmedName.length === 0) {
      throw new Error('이름은 필수입니다');
    }

    return new Contact(args.id, args.email, trimmedName);
  }

  /**
   * 프로필 업데이트
   * @throws 이름이 비어있는 경우
   */
  updateProfile(name: string): void {
    const trimmedName = name?.trim() ?? '';
    if (trimmedName.length === 0) {
      throw new Error('이름은 필수입니다');
    }
    this._name = trimmedName;
  }

  /**
   * 커스텀 필드 값 설정
   * - 기존 값이 있으면 업데이트
   * - 없으면 새로 생성
   * @throws 필드가 비활성화된 경우
   * @throws 값이 유효하지 않은 경우
   */
  setCustomFieldValue(
    valueId: string,
    fieldDefinition: CustomFieldDefinition,
    value: string | number | null,
  ): void {
    if (!fieldDefinition.isActive) {
      throw new Error('비활성화된 필드에는 값을 설정할 수 없습니다');
    }

    const existingValue = this._customFieldValues.get(fieldDefinition.id);

    if (existingValue) {
      existingValue.updateValue(fieldDefinition, value);
    } else {
      const newValue = CustomFieldValue.create({
        id: valueId,
        contactId: this._id,
        fieldDefinition,
        value,
      });
      this._customFieldValues.set(fieldDefinition.id, newValue);
    }
  }

  /**
   * 커스텀 필드 값 조회
   * @param fieldDefinitionId 필드 정의 ID
   * @returns 값이 없으면 undefined
   */
  getCustomFieldValue(fieldDefinitionId: string): CustomFieldValue | undefined {
    return this._customFieldValues.get(fieldDefinitionId);
  }

  /**
   * 모든 커스텀 필드 값 조회
   */
  getAllCustomFieldValues(): CustomFieldValue[] {
    return Array.from(this._customFieldValues.values());
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get email(): string {
    return this._email;
  }

  get name(): string {
    return this._name;
  }
}

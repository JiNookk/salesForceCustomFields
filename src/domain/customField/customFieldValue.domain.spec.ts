import { CustomFieldDefinition } from './customFieldDefinition.domain';
import { CustomFieldValue } from './customFieldValue.domain';
import { FieldType } from './fieldType.vo';

describe('CustomFieldValue', () => {
  // 테스트용 필드 정의 헬퍼
  const createTextField = () =>
    CustomFieldDefinition.create({
      id: 'def-1',
      name: '메모',
      apiName: 'memo__c',
      fieldType: FieldType.TEXT,
    });

  const createNumberField = () =>
    CustomFieldDefinition.create({
      id: 'def-2',
      name: '나이',
      apiName: 'age__c',
      fieldType: FieldType.NUMBER,
    });

  const createDateField = () =>
    CustomFieldDefinition.create({
      id: 'def-3',
      name: '생년월일',
      apiName: 'birth_date__c',
      fieldType: FieldType.DATE,
    });

  const createSelectField = () =>
    CustomFieldDefinition.create({
      id: 'def-4',
      name: '등급',
      apiName: 'tier__c',
      fieldType: FieldType.SELECT,
      options: ['BRONZE', 'SILVER', 'GOLD'],
    });

  const createRequiredTextField = () =>
    CustomFieldDefinition.create({
      id: 'def-5',
      name: '전화번호',
      apiName: 'phone__c',
      fieldType: FieldType.TEXT,
      isRequired: true,
    });

  describe('생성', () => {
    it('TEXT 타입 값을 생성할 수 있다', () => {
      // Given
      const fieldDef = createTextField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-1',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: '안녕하세요',
      });

      // Then
      expect(value.id).toBe('val-1');
      expect(value.contactId).toBe('contact-1');
      expect(value.fieldDefinitionId).toBe('def-1');
      expect(value.getValue()).toBe('안녕하세요');
    });

    it('NUMBER 타입 값을 생성할 수 있다', () => {
      // Given
      const fieldDef = createNumberField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-2',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: 25,
      });

      // Then
      expect(value.getValue()).toBe(25);
    });

    it('DATE 타입 값을 생성할 수 있다', () => {
      // Given
      const fieldDef = createDateField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-3',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: '1990-01-15',
      });

      // Then
      expect(value.getValue()).toBe('1990-01-15');
    });

    it('SELECT 타입 값을 생성할 수 있다', () => {
      // Given
      const fieldDef = createSelectField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-4',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: 'GOLD',
      });

      // Then
      expect(value.getValue()).toBe('GOLD');
    });

    it('null 값으로 생성할 수 있다 (optional 필드)', () => {
      // Given
      const fieldDef = createTextField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-5',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: null,
      });

      // Then
      expect(value.getValue()).toBe(null);
    });

    it('유효하지 않은 값으로 생성하면 에러가 발생한다', () => {
      // Given
      const fieldDef = createNumberField();

      // When & Then
      expect(() =>
        CustomFieldValue.create({
          id: 'val-6',
          contactId: 'contact-1',
          fieldDefinition: fieldDef,
          value: '문자열',
        }),
      ).toThrow('숫자 형식이어야 합니다');
    });

    it('필수 필드에 null 값으로 생성하면 에러가 발생한다', () => {
      // Given
      const fieldDef = createRequiredTextField();

      // When & Then
      expect(() =>
        CustomFieldValue.create({
          id: 'val-7',
          contactId: 'contact-1',
          fieldDefinition: fieldDef,
          value: null,
        }),
      ).toThrow('전화번호은(는) 필수 항목입니다');
    });

    it('SELECT 필드에 허용되지 않은 값으로 생성하면 에러가 발생한다', () => {
      // Given
      const fieldDef = createSelectField();

      // When & Then
      expect(() =>
        CustomFieldValue.create({
          id: 'val-8',
          contactId: 'contact-1',
          fieldDefinition: fieldDef,
          value: 'PLATINUM',
        }),
      ).toThrow('허용된 값: BRONZE, SILVER, GOLD');
    });
  });

  describe('값 업데이트', () => {
    it('TEXT 값을 업데이트할 수 있다', () => {
      // Given
      const fieldDef = createTextField();
      const value = CustomFieldValue.create({
        id: 'val-1',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: '안녕하세요',
      });

      // When
      value.updateValue(fieldDef, '반갑습니다');

      // Then
      expect(value.getValue()).toBe('반갑습니다');
    });

    it('NUMBER 값을 업데이트할 수 있다', () => {
      // Given
      const fieldDef = createNumberField();
      const value = CustomFieldValue.create({
        id: 'val-2',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: 25,
      });

      // When
      value.updateValue(fieldDef, 30);

      // Then
      expect(value.getValue()).toBe(30);
    });

    it('값을 null로 업데이트할 수 있다 (optional 필드)', () => {
      // Given
      const fieldDef = createTextField();
      const value = CustomFieldValue.create({
        id: 'val-3',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: '안녕하세요',
      });

      // When
      value.updateValue(fieldDef, null);

      // Then
      expect(value.getValue()).toBe(null);
    });

    it('유효하지 않은 값으로 업데이트하면 에러가 발생한다', () => {
      // Given
      const fieldDef = createDateField();
      const value = CustomFieldValue.create({
        id: 'val-4',
        contactId: 'contact-1',
        fieldDefinition: fieldDef,
        value: '1990-01-15',
      });

      // When & Then
      expect(() => value.updateValue(fieldDef, '01/15/1990')).toThrow(
        'YYYY-MM-DD 형식이어야 합니다',
      );
    });
  });
});

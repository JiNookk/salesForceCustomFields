import { CustomFieldDefinition } from './customFieldDefinition.domain';
import { CustomFieldValue } from './customFieldValue.domain';
import { FieldType } from './fieldType.vo';

describe('CustomFieldValue', () => {
  // 테스트용 필드 정의 헬퍼
  const createTextField = () => {
    const field = CustomFieldDefinition.create({
      id: 'def-1',
      name: '메모',
      apiName: 'memo__c',
      fieldType: FieldType.TEXT,
    });
    field.activate();
    return field;
  };

  const createNumberField = () => {
    const field = CustomFieldDefinition.create({
      id: 'def-2',
      name: '나이',
      apiName: 'age__c',
      fieldType: FieldType.NUMBER,
    });
    field.activate();
    return field;
  };

  const createDateField = () => {
    const field = CustomFieldDefinition.create({
      id: 'def-3',
      name: '생년월일',
      apiName: 'birth_date__c',
      fieldType: FieldType.DATE,
    });
    field.activate();
    return field;
  };

  const createSelectField = () => {
    const field = CustomFieldDefinition.create({
      id: 'def-4',
      name: '등급',
      apiName: 'tier__c',
      fieldType: FieldType.SELECT,
      options: ['BRONZE', 'SILVER', 'GOLD'],
    });
    field.activate();
    return field;
  };

  describe('생성', () => {
    it('TEXT 타입 값을 생성할 수 있다', () => {
      // Given
      const fieldDef = createTextField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-1',
        fieldDefinition: fieldDef,
        value: '안녕하세요',
      });

      // Then
      expect(value.id).toBe('val-1');
      expect(value.fieldDefinition.id).toBe('def-1');
      expect(value.getValue()).toBe('안녕하세요');
    });

    it('NUMBER 타입 값을 생성할 수 있다', () => {
      // Given
      const fieldDef = createNumberField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-2',
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
        fieldDefinition: fieldDef,
        value: '1990-01-15',
      });

      // Then
      const dateValue = value.getValue() as Date;
      expect(dateValue).toBeInstanceOf(Date);
      expect(dateValue.toISOString().split('T')[0]).toBe('1990-01-15');
    });

    it('SELECT 타입 값을 생성할 수 있다', () => {
      // Given
      const fieldDef = createSelectField();

      // When
      const value = CustomFieldValue.create({
        id: 'val-4',
        fieldDefinition: fieldDef,
        value: 'GOLD',
      });

      // Then
      expect(value.getValue()).toBe('GOLD');
    });

    it('유효하지 않은 값으로 생성하면 에러가 발생한다', () => {
      // Given
      const fieldDef = createNumberField();

      // When & Then
      expect(() =>
        CustomFieldValue.create({
          id: 'val-6',
          fieldDefinition: fieldDef,
          value: '문자열',
        }),
      ).toThrow('숫자 형식이어야 합니다');
    });

    it('SELECT 필드에 허용되지 않은 값으로 생성하면 에러가 발생한다', () => {
      // Given
      const fieldDef = createSelectField();

      // When & Then
      expect(() =>
        CustomFieldValue.create({
          id: 'val-8',
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
        fieldDefinition: fieldDef,
        value: '안녕하세요',
      });

      // When
      value.updateValue('반갑습니다');

      // Then
      expect(value.getValue()).toBe('반갑습니다');
    });

    it('NUMBER 값을 업데이트할 수 있다', () => {
      // Given
      const fieldDef = createNumberField();
      const value = CustomFieldValue.create({
        id: 'val-2',
        fieldDefinition: fieldDef,
        value: 25,
      });

      // When
      value.updateValue(30);

      // Then
      expect(value.getValue()).toBe(30);
    });

    it('DATE 값을 업데이트할 수 있다', () => {
      // Given
      const fieldDef = createDateField();
      const value = CustomFieldValue.create({
        id: 'val-3',
        fieldDefinition: fieldDef,
        value: '1990-01-15',
      });

      // When
      value.updateValue('2000-12-25');

      // Then
      const dateValue = value.getValue() as Date;
      expect(dateValue.toISOString().split('T')[0]).toBe('2000-12-25');
    });

    it('유효하지 않은 값으로 업데이트하면 에러가 발생한다', () => {
      // Given
      const fieldDef = createDateField();
      const value = CustomFieldValue.create({
        id: 'val-4',
        fieldDefinition: fieldDef,
        value: '1990-01-15',
      });

      // When & Then
      expect(() => value.updateValue('01/15/1990')).toThrow(
        'YYYY-MM-DD 형식이어야 합니다',
      );
    });
  });
});

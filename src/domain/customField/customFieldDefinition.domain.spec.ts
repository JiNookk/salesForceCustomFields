import { CustomFieldDefinition } from './customFieldDefinition.domain';
import { FieldType } from './fieldType.vo';

describe('CustomFieldDefinition', () => {
  describe('생성', () => {
    it('TEXT 타입 필드를 생성할 수 있다', () => {
      // Given
      const args = {
        id: 'field-1',
        name: '메모',
        apiName: 'memo__c',
        fieldType: FieldType.TEXT,
      };

      // When
      const field = CustomFieldDefinition.create(args);

      // Then
      expect(field.id).toBe('field-1');
      expect(field.name).toBe('메모');
      expect(field.apiName).toBe('memo__c');
      expect(field.fieldType).toBe(FieldType.TEXT);
      expect(field.isRequired).toBe(false);
      expect(field.isActive).toBe(true);
    });

    it('NUMBER 타입 필드를 생성할 수 있다', () => {
      // Given
      const args = {
        id: 'field-2',
        name: '나이',
        apiName: 'age__c',
        fieldType: FieldType.NUMBER,
      };

      // When
      const field = CustomFieldDefinition.create(args);

      // Then
      expect(field.fieldType).toBe(FieldType.NUMBER);
    });

    it('DATE 타입 필드를 생성할 수 있다', () => {
      // Given
      const args = {
        id: 'field-3',
        name: '생년월일',
        apiName: 'birth_date__c',
        fieldType: FieldType.DATE,
      };

      // When
      const field = CustomFieldDefinition.create(args);

      // Then
      expect(field.fieldType).toBe(FieldType.DATE);
    });

    it('SELECT 타입 필드는 options와 함께 생성할 수 있다', () => {
      // Given
      const args = {
        id: 'field-4',
        name: '등급',
        apiName: 'tier__c',
        fieldType: FieldType.SELECT,
        options: ['BRONZE', 'SILVER', 'GOLD'],
      };

      // When
      const field = CustomFieldDefinition.create(args);

      // Then
      expect(field.fieldType).toBe(FieldType.SELECT);
      expect(field.options).toEqual(['BRONZE', 'SILVER', 'GOLD']);
    });

    it('SELECT 타입 필드는 options가 없으면 에러가 발생한다', () => {
      // Given
      const args = {
        id: 'field-5',
        name: '등급',
        apiName: 'tier__c',
        fieldType: FieldType.SELECT,
      };

      // When & Then
      expect(() => CustomFieldDefinition.create(args)).toThrow(
        'SELECT 타입은 최소 1개 이상의 옵션이 필요합니다',
      );
    });

    it('SELECT 타입 필드는 빈 options 배열이면 에러가 발생한다', () => {
      // Given
      const args = {
        id: 'field-6',
        name: '등급',
        apiName: 'tier__c',
        fieldType: FieldType.SELECT,
        options: [],
      };

      // When & Then
      expect(() => CustomFieldDefinition.create(args)).toThrow(
        'SELECT 타입은 최소 1개 이상의 옵션이 필요합니다',
      );
    });

    it('apiName이 __c로 끝나지 않으면 에러가 발생한다', () => {
      // Given
      const args = {
        id: 'field-7',
        name: '메모',
        apiName: 'memo',
        fieldType: FieldType.TEXT,
      };

      // When & Then
      expect(() => CustomFieldDefinition.create(args)).toThrow(
        'API 이름은 영문 소문자로 시작하고 __c로 끝나야 합니다',
      );
    });

    it('apiName이 대문자를 포함하면 에러가 발생한다', () => {
      // Given
      const args = {
        id: 'field-8',
        name: '메모',
        apiName: 'Memo__c',
        fieldType: FieldType.TEXT,
      };

      // When & Then
      expect(() => CustomFieldDefinition.create(args)).toThrow(
        'API 이름은 영문 소문자로 시작하고 __c로 끝나야 합니다',
      );
    });

    it('필수 필드로 생성할 수 있다', () => {
      // Given
      const args = {
        id: 'field-9',
        name: '전화번호',
        apiName: 'phone__c',
        fieldType: FieldType.TEXT,
        isRequired: true,
      };

      // When
      const field = CustomFieldDefinition.create(args);

      // Then
      expect(field.isRequired).toBe(true);
    });
  });

  describe('값 검증', () => {
    describe('TEXT 타입', () => {
      it('문자열 값은 유효하다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '메모',
          apiName: 'memo__c',
          fieldType: FieldType.TEXT,
        });

        // When
        const result = field.validateValue('안녕하세요');

        // Then
        expect(result.valid).toBe(true);
      });

      it('숫자 값은 유효하지 않다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '메모',
          apiName: 'memo__c',
          fieldType: FieldType.TEXT,
        });

        // When
        const result = field.validateValue(123);

        // Then
        expect(result.valid).toBe(false);
        expect(result.error).toBe('텍스트 형식이어야 합니다');
      });
    });

    describe('NUMBER 타입', () => {
      it('숫자 값은 유효하다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '나이',
          apiName: 'age__c',
          fieldType: FieldType.NUMBER,
        });

        // When
        const result = field.validateValue(25);

        // Then
        expect(result.valid).toBe(true);
      });

      it('소수점 숫자도 유효하다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '금액',
          apiName: 'amount__c',
          fieldType: FieldType.NUMBER,
        });

        // When
        const result = field.validateValue(99.99);

        // Then
        expect(result.valid).toBe(true);
      });

      it('문자열 값은 유효하지 않다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '나이',
          apiName: 'age__c',
          fieldType: FieldType.NUMBER,
        });

        // When
        const result = field.validateValue('25');

        // Then
        expect(result.valid).toBe(false);
        expect(result.error).toBe('숫자 형식이어야 합니다');
      });

      it('NaN은 유효하지 않다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '나이',
          apiName: 'age__c',
          fieldType: FieldType.NUMBER,
        });

        // When
        const result = field.validateValue(NaN);

        // Then
        expect(result.valid).toBe(false);
        expect(result.error).toBe('숫자 형식이어야 합니다');
      });
    });

    describe('DATE 타입', () => {
      it('YYYY-MM-DD 형식의 날짜는 유효하다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '생년월일',
          apiName: 'birth_date__c',
          fieldType: FieldType.DATE,
        });

        // When
        const result = field.validateValue('1990-01-15');

        // Then
        expect(result.valid).toBe(true);
      });

      it('잘못된 날짜 형식은 유효하지 않다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '생년월일',
          apiName: 'birth_date__c',
          fieldType: FieldType.DATE,
        });

        // When
        const result = field.validateValue('01/15/1990');

        // Then
        expect(result.valid).toBe(false);
        expect(result.error).toBe('YYYY-MM-DD 형식이어야 합니다');
      });

      it('Date 객체는 유효하지 않다 (문자열만 허용)', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '생년월일',
          apiName: 'birth_date__c',
          fieldType: FieldType.DATE,
        });

        // When
        const result = field.validateValue(new Date());

        // Then
        expect(result.valid).toBe(false);
      });
    });

    describe('SELECT 타입', () => {
      it('옵션에 포함된 값은 유효하다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '등급',
          apiName: 'tier__c',
          fieldType: FieldType.SELECT,
          options: ['BRONZE', 'SILVER', 'GOLD'],
        });

        // When
        const result = field.validateValue('GOLD');

        // Then
        expect(result.valid).toBe(true);
      });

      it('옵션에 없는 값은 유효하지 않다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '등급',
          apiName: 'tier__c',
          fieldType: FieldType.SELECT,
          options: ['BRONZE', 'SILVER', 'GOLD'],
        });

        // When
        const result = field.validateValue('PLATINUM');

        // Then
        expect(result.valid).toBe(false);
        expect(result.error).toBe('허용된 값: BRONZE, SILVER, GOLD');
      });
    });

    describe('필수 필드', () => {
      it('필수 필드에 null 값은 유효하지 않다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '전화번호',
          apiName: 'phone__c',
          fieldType: FieldType.TEXT,
          isRequired: true,
        });

        // When
        const result = field.validateValue(null);

        // Then
        expect(result.valid).toBe(false);
        expect(result.error).toBe('전화번호은(는) 필수 항목입니다');
      });

      it('필수가 아닌 필드에 null 값은 유효하다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '메모',
          apiName: 'memo__c',
          fieldType: FieldType.TEXT,
          isRequired: false,
        });

        // When
        const result = field.validateValue(null);

        // Then
        expect(result.valid).toBe(true);
      });

      it('필수가 아닌 필드에 undefined 값은 유효하다', () => {
        // Given
        const field = CustomFieldDefinition.create({
          id: 'field-1',
          name: '메모',
          apiName: 'memo__c',
          fieldType: FieldType.TEXT,
          isRequired: false,
        });

        // When
        const result = field.validateValue(undefined);

        // Then
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('상태 변경', () => {
    it('필드를 비활성화할 수 있다', () => {
      // Given
      const field = CustomFieldDefinition.create({
        id: 'field-1',
        name: '메모',
        apiName: 'memo__c',
        fieldType: FieldType.TEXT,
      });

      // When
      field.deactivate();

      // Then
      expect(field.isActive).toBe(false);
    });

    it('비활성화된 필드를 다시 활성화할 수 있다', () => {
      // Given
      const field = CustomFieldDefinition.create({
        id: 'field-1',
        name: '메모',
        apiName: 'memo__c',
        fieldType: FieldType.TEXT,
      });
      field.deactivate();

      // When
      field.activate();

      // Then
      expect(field.isActive).toBe(true);
    });
  });
});

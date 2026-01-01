import { Contact } from './contact.domain';
import { CustomFieldDefinition } from '../customField/customFieldDefinition.domain';
import { FieldType } from '../customField/fieldType.vo';

describe('Contact', () => {
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

  const createInactiveField = () => {
    const field = CustomFieldDefinition.create({
      id: 'def-3',
      name: '비활성 필드',
      apiName: 'inactive__c',
      fieldType: FieldType.TEXT,
    });
    field.deactivate();
    return field;
  };

  describe('생성', () => {
    it('Contact를 생성할 수 있다', () => {
      // Given
      const args = {
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      };

      // When
      const contact = Contact.create(args);

      // Then
      expect(contact.id).toBe('contact-1');
      expect(contact.email).toBe('user@example.com');
      expect(contact.name).toBe('홍길동');
    });

    it('이름 앞뒤 공백은 자동으로 제거된다', () => {
      // Given
      const args = {
        id: 'contact-1',
        email: 'user@example.com',
        name: '  홍길동  ',
      };

      // When
      const contact = Contact.create(args);

      // Then
      expect(contact.name).toBe('홍길동');
    });

    it('유효하지 않은 이메일 형식이면 에러가 발생한다', () => {
      // Given
      const args = {
        id: 'contact-1',
        email: 'invalid-email',
        name: '홍길동',
      };

      // When & Then
      expect(() => Contact.create(args)).toThrow(
        '유효한 이메일 형식이 아닙니다',
      );
    });

    it('이름이 비어있으면 에러가 발생한다', () => {
      // Given
      const args = {
        id: 'contact-1',
        email: 'user@example.com',
        name: '',
      };

      // When & Then
      expect(() => Contact.create(args)).toThrow('이름은 필수입니다');
    });

    it('이름이 공백만 있으면 에러가 발생한다', () => {
      // Given
      const args = {
        id: 'contact-1',
        email: 'user@example.com',
        name: '   ',
      };

      // When & Then
      expect(() => Contact.create(args)).toThrow('이름은 필수입니다');
    });
  });

  describe('프로필 업데이트', () => {
    it('이름을 변경할 수 있다', () => {
      // Given
      const contact = Contact.create({
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      });

      // When
      contact.updateProfile('김철수');

      // Then
      expect(contact.name).toBe('김철수');
    });

    it('빈 이름으로 변경하면 에러가 발생한다', () => {
      // Given
      const contact = Contact.create({
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      });

      // When & Then
      expect(() => contact.updateProfile('')).toThrow('이름은 필수입니다');
    });
  });

  describe('커스텀 필드 관리', () => {
    it('커스텀 필드 값을 설정할 수 있다', () => {
      // Given
      const contact = Contact.create({
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      });
      const fieldDef = createTextField();

      // When
      contact.setCustomFieldValue('val-1', fieldDef, '메모 내용');

      // Then
      const value = contact.getCustomFieldValue(fieldDef.id);
      expect(value).toBeDefined();
      expect(value?.getValue()).toBe('메모 내용');
    });

    it('여러 커스텀 필드 값을 설정할 수 있다', () => {
      // Given
      const contact = Contact.create({
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      });
      const textField = createTextField();
      const numberField = createNumberField();

      // When
      contact.setCustomFieldValue('val-1', textField, '메모 내용');
      contact.setCustomFieldValue('val-2', numberField, 25);

      // Then
      const allValues = contact.getAllCustomFieldValues();
      expect(allValues).toHaveLength(2);
    });

    it('동일한 필드의 값을 업데이트할 수 있다', () => {
      // Given
      const contact = Contact.create({
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      });
      const fieldDef = createTextField();
      contact.setCustomFieldValue('val-1', fieldDef, '원래 값');

      // When
      contact.setCustomFieldValue('val-1', fieldDef, '새로운 값');

      // Then
      const value = contact.getCustomFieldValue(fieldDef.id);
      expect(value?.getValue()).toBe('새로운 값');
    });

    it('비활성화된 필드에는 값을 설정할 수 없다', () => {
      // Given
      const contact = Contact.create({
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      });
      const inactiveField = createInactiveField();

      // When & Then
      expect(() =>
        contact.setCustomFieldValue('val-1', inactiveField, '값'),
      ).toThrow('비활성화된 필드에는 값을 설정할 수 없습니다');
    });

    it('설정되지 않은 필드 값을 조회하면 undefined를 반환한다', () => {
      // Given
      const contact = Contact.create({
        id: 'contact-1',
        email: 'user@example.com',
        name: '홍길동',
      });

      // When
      const value = contact.getCustomFieldValue('non-existent');

      // Then
      expect(value).toBeUndefined();
    });
  });
});

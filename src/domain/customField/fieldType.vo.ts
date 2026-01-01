/**
 * 커스텀 필드 타입 Value Object
 * - TEXT: 텍스트
 * - NUMBER: 숫자
 * - DATE: 날짜 (YYYY-MM-DD)
 * - SELECT: 선택형 (옵션 목록에서 선택)
 */
export const FieldType = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
  SELECT: 'SELECT',
} as const;

export type FieldType = (typeof FieldType)[keyof typeof FieldType];

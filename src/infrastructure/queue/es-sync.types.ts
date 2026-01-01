/**
 * ES 동기화 이벤트 타입
 */
export const ES_SYNC_QUEUE = 'es-sync';

export type EsSyncEventType =
  | 'CONTACT_CREATED'
  | 'CONTACT_UPDATED'
  | 'CONTACT_DELETED';

export interface EsSyncJobData {
  type: EsSyncEventType;
  contactId: string;
  payload?: ContactPayload;
  timestamp: Date;
}

export interface ContactPayload {
  id: string;
  email: string;
  name: string;
  customFields: Record<string, string | number | Date | null>;
  createdAt: Date;
  updatedAt: Date;
}

import type { NotificationDeliverySummary, NotificationRecord } from "../core/notification-types.js";

export interface CreateNotificationInput {
  type: string;
  severity: NotificationRecord["severity"];
  title: string;
  message: string;
  source: string | null;
  href: string | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
}

export interface NotificationStorePort {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  list(options?: ListNotificationsOptions): Promise<NotificationRecord[]>;
  countAll(): Promise<number>;
  countUnread(): Promise<number>;
  updateDeliverySummary(id: string, deliverySummary: NotificationDeliverySummary): Promise<NotificationRecord | null>;
  markRead(id: string): Promise<NotificationRecord | null>;
  markAllRead(): Promise<{ updatedCount: number; unreadCount: number }>;
}

import type { NotificationDeliveryFailure, NotificationSeverity } from "../core/types.js";

export type AlertHistoryStatus = "delivered" | "suppressed" | "partial_failure" | "failed";

export interface AlertHistoryRecord {
  id: string;
  ruleName: string;
  eventType: string;
  severity: NotificationSeverity;
  status: AlertHistoryStatus;
  channels: string[];
  deliveredChannels: string[];
  failedChannels: NotificationDeliveryFailure[];
  message: string;
  createdAt: string;
}

export interface CreateAlertHistoryInput {
  ruleName: string;
  eventType: string;
  severity: NotificationSeverity;
  status: AlertHistoryStatus;
  channels: string[];
  deliveredChannels: string[];
  failedChannels: NotificationDeliveryFailure[];
  message: string;
  createdAt: string;
}

export interface ListAlertHistoryOptions {
  limit?: number;
  ruleName?: string;
}

export interface AlertHistoryStorePort {
  create(input: CreateAlertHistoryInput): Promise<AlertHistoryRecord>;
  list(options?: ListAlertHistoryOptions): Promise<AlertHistoryRecord[]>;
}

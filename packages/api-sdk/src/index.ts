import type {
  AdminOverview,
  BookingRecord,
  BusinessSummary,
  CheckoutPaymentInput,
  ConversationRecord,
  MessageRecord,
  NotificationPreferenceInput,
  NotificationPreferenceRecord,
  NotificationRecord,
  PaymentRecord,
  Role,
  SessionPayload,
} from '@beauty-finder/types';

export interface ApiClient {
  getSession(): Promise<SessionPayload>;
  getBusinesses(params?: {
    category?: string;
    city?: string;
    search?: string;
  }): Promise<BusinessSummary[]>;
  getBookings(params: { userId: string; role: Role }): Promise<BookingRecord[]>;
  getPayments(params: { userId: string; role: Role }): Promise<PaymentRecord[]>;
  checkoutPayment(input: CheckoutPaymentInput): Promise<PaymentRecord>;
  getConversations(userId: string): Promise<ConversationRecord[]>;
  getMessages(conversationId: string): Promise<MessageRecord[]>;
  getNotifications(userId: string): Promise<NotificationRecord[]>;
  getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferenceRecord>;
  updateNotificationPreferences(
    userId: string,
    input: NotificationPreferenceInput,
  ): Promise<NotificationPreferenceRecord>;
  getAdminOverview(): Promise<AdminOverview>;
}

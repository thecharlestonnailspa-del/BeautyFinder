import { z } from 'zod';

export const createBookingSchema = z.object({
  customerId: z.string().min(1),
  ownerId: z.string().min(1),
  businessId: z.string().min(1),
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});

export const checkoutPaymentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(['card', 'cash']),
  tipAmount: z.number().min(0).max(500).optional(),
  cardBrand: z.string().trim().min(1).max(40).optional(),
  cardLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .optional(),
});

export const createMessageSchema = z.object({
  senderId: z.string().min(1),
  body: z.string().min(1).max(1000),
});

export const businessSearchSchema = z.object({
  category: z.enum(['nail', 'hair']).optional(),
  city: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
});

export const notificationPreferenceSchema = z
  .object({
    bookingCreated: z.boolean().optional(),
    bookingConfirmed: z.boolean().optional(),
    messageReceived: z.boolean().optional(),
    paymentReceipt: z.boolean().optional(),
    reviewReceived: z.boolean().optional(),
    system: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one notification preference must be provided',
  });

export const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string().min(1)).optional(),
  markAll: z.boolean().optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CheckoutPaymentInput = z.infer<typeof checkoutPaymentSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type BusinessSearchInput = z.infer<typeof businessSearchSchema>;
export type NotificationPreferenceInput = z.infer<
  typeof notificationPreferenceSchema
>;
export type MarkNotificationsReadInput = z.infer<
  typeof markNotificationsReadSchema
>;

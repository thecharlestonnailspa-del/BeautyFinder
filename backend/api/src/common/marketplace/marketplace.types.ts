import { Prisma } from '@prisma/client';

export type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: true } }>;

export type BusinessWithRelations = Prisma.BusinessGetPayload<{
  include: { services: true; images: true; staff: true };
}>;

export type BusinessWithOwner = Prisma.BusinessGetPayload<{
  include: { owner: true };
}>;

export type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: { business: true; customer: true };
}>;

export type AdminActionWithAdmin = Prisma.AdminActionGetPayload<{
  include: { admin: true };
}>;

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: { appointment: { include: { service: true } } };
}>;

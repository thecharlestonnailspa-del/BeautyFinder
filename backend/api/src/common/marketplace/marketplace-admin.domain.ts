import { NotFoundException } from '@nestjs/common';
import type {
  AdminActionRecord,
  AdminBusinessQueueItem,
  AdminConversationCase,
  AdminOverview,
  AdminReviewQueueItem,
  BusinessModerationStatus,
  BusinessSummary,
  ReviewModerationStatus,
} from '@beauty-finder/types';
import {
  AppointmentStatus,
  BusinessStatus,
  Prisma,
  ReviewStatus,
} from '@prisma/client';
import {
  serializeAdminMetadata,
  sortBusinessesForHomepage,
  toBusinessSummary,
} from './marketplace-mappers.helpers';
import type {
  AdminActionWithAdmin,
  BusinessWithOwner,
  BusinessWithRelations,
  ReviewWithRelations,
} from './marketplace.types';
import type { PrismaService } from '../prisma.service';

export type AdminDomainDependencies = {
  prisma: PrismaService;
  businessStatusOrder: Record<BusinessModerationStatus, number>;
  conversationCaseStatusOrder: Record<
    AdminConversationCase['caseStatus'],
    number
  >;
  toBusinessStatus: (status: BusinessModerationStatus) => BusinessStatus;
  fromBusinessStatus: (status: BusinessStatus) => BusinessModerationStatus;
  toReviewStatus: (status: ReviewModerationStatus) => ReviewStatus;
  fromReviewStatus: (status: ReviewStatus) => ReviewModerationStatus;
  toAdminBusinessQueueItem: (
    business: BusinessWithOwner,
  ) => AdminBusinessQueueItem;
  toAdminReviewQueueItem: (
    review: ReviewWithRelations,
  ) => AdminReviewQueueItem;
  toAdminActionRecord: (action: AdminActionWithAdmin) => AdminActionRecord;
  getConversationPriority: (
    lastMessage: string,
    bookingId?: string,
  ) => AdminConversationCase['priority'];
  getConversationCaseStatus: (
    action?: string,
  ) => AdminConversationCase['caseStatus'];
  createNotification: (
    client: Prisma.TransactionClient | PrismaService,
    input: {
      userId: string;
      type: 'system';
      title: string;
      body?: string;
      payload?: Record<string, unknown>;
      createdAt?: Date;
    },
  ) => Promise<unknown>;
  invalidateCatalogCache: () => Promise<void>;
  getPublicBusinessInclude: () => Prisma.BusinessFindManyArgs['include'];
};

const featuredBusinessInclude = {
  services: { where: { isActive: true } },
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
  staff: true,
} satisfies Prisma.BusinessFindManyArgs['include'];

async function recordAdminAction(
  deps: AdminDomainDependencies,
  input: {
    adminUserId: string;
    targetType: string;
    targetId: string;
    action: string;
    note?: string;
    extra?: Record<string, unknown>;
  },
) {
  await deps.prisma.adminAction.create({
    data: {
      adminUserId: input.adminUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      action: input.action,
      metadata: serializeAdminMetadata(input.note, input.extra),
    },
  });
}

async function getCurrentFeaturedBusinessIds(
  deps: AdminDomainDependencies,
  excludedBusinessId?: string,
) {
  const featuredBusinesses = await deps.prisma.business.findMany({
    where: {
      status: BusinessStatus.APPROVED,
      featuredOnHomepage: true,
      ...(excludedBusinessId ? { id: { not: excludedBusinessId } } : {}),
    },
    include: featuredBusinessInclude,
  });

  return sortBusinessesForHomepage(
    featuredBusinesses.map((business) =>
      toBusinessSummary(business as BusinessWithRelations),
    ),
  ).map((business) => business.id);
}

async function persistHomepageOrder(
  deps: AdminDomainDependencies,
  featuredIds: string[],
) {
  const approvedBusinesses = await deps.prisma.business.findMany({
    where: { status: BusinessStatus.APPROVED },
    select: { id: true },
  });

  const hiddenIds = approvedBusinesses
    .map((business) => business.id)
    .filter((id) => !featuredIds.includes(id));

  await deps.prisma.$transaction([
    ...featuredIds.map((id, index) =>
      deps.prisma.business.update({
        where: { id },
        data: {
          featuredOnHomepage: true,
          homepageRank: index + 1,
        },
      }),
    ),
    deps.prisma.business.updateMany({
      where: { id: { in: hiddenIds } },
      data: {
        featuredOnHomepage: false,
        homepageRank: 999,
      },
    }),
  ]);
}

export async function getAdminBusinessesFlow(
  deps: AdminDomainDependencies,
  status?: BusinessModerationStatus,
): Promise<AdminBusinessQueueItem[]> {
  const businesses = await deps.prisma.business.findMany({
    where: status ? { status: deps.toBusinessStatus(status) } : undefined,
    include: {
      owner: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return businesses
    .map((business) => deps.toAdminBusinessQueueItem(business))
    .sort((left, right) => {
      if (
        deps.businessStatusOrder[left.status] !==
        deps.businessStatusOrder[right.status]
      ) {
        return (
          deps.businessStatusOrder[left.status] -
          deps.businessStatusOrder[right.status]
        );
      }

      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
}

export async function updateHomepagePlacementFlow(
  deps: AdminDomainDependencies,
  businessId: string,
  input: { featuredOnHomepage: boolean; homepageRank: number },
): Promise<BusinessSummary> {
  const approvedBusiness = await deps.prisma.business.findFirst({
    where: {
      id: businessId,
      status: BusinessStatus.APPROVED,
    },
    select: { id: true },
  });

  if (!approvedBusiness) {
    throw new NotFoundException('Business not found in the homepage queue');
  }

  const currentFeaturedIds = await getCurrentFeaturedBusinessIds(
    deps,
    businessId,
  );
  const normalizedFeaturedIds = [...currentFeaturedIds];

  if (input.featuredOnHomepage) {
    const insertIndex = Math.min(
      normalizedFeaturedIds.length,
      Math.max(0, input.homepageRank - 1),
    );
    normalizedFeaturedIds.splice(insertIndex, 0, businessId);
  }

  await persistHomepageOrder(deps, normalizedFeaturedIds);

  const updatedBusiness = await deps.prisma.business.findUnique({
    where: { id: businessId },
    include: deps.getPublicBusinessInclude(),
  });

  if (!updatedBusiness) {
    throw new NotFoundException('Business not found after homepage update');
  }

  await deps.invalidateCatalogCache();

  return toBusinessSummary(updatedBusiness as BusinessWithRelations);
}

export async function updateBusinessStatusFlow(
  deps: AdminDomainDependencies,
  businessId: string,
  input: { status: BusinessModerationStatus; note?: string },
  adminUserId: string,
): Promise<AdminBusinessQueueItem> {
  const nextStatus = deps.toBusinessStatus(input.status);
  const existingBusiness = await deps.prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: true,
    },
  });

  if (!existingBusiness) {
    throw new NotFoundException('Business not found');
  }

  const updatedBusiness = await deps.prisma.business.update({
    where: { id: businessId },
    data: {
      status: nextStatus,
      ...(nextStatus !== BusinessStatus.APPROVED
        ? {
            featuredOnHomepage: false,
            homepageRank: 999,
          }
        : {}),
    },
    include: {
      owner: true,
    },
  });

  if (nextStatus !== BusinessStatus.APPROVED) {
    await persistHomepageOrder(
      deps,
      await getCurrentFeaturedBusinessIds(deps, businessId),
    );
  }

  await deps.createNotification(deps.prisma, {
    userId: updatedBusiness.ownerUserId,
    type: 'system',
    title: 'Business moderation update',
    body: `${updatedBusiness.name} is now ${input.status.replace('_', ' ')}.`,
  });

  await recordAdminAction(deps, {
    adminUserId,
    targetType: 'business',
    targetId: businessId,
    action: `${input.status}_business`,
    note: input.note,
    extra: {
      previousStatus: deps.fromBusinessStatus(existingBusiness.status),
    },
  });

  await deps.invalidateCatalogCache();

  return deps.toAdminBusinessQueueItem(updatedBusiness);
}

export async function getAdminReviewsFlow(
  deps: AdminDomainDependencies,
  status?: ReviewModerationStatus,
) {
  const reviews = await deps.prisma.review.findMany({
    where: status ? { status: deps.toReviewStatus(status) } : undefined,
    include: {
      business: true,
      customer: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return reviews
    .map((review) => deps.toAdminReviewQueueItem(review))
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'flagged' ? -1 : 1;
      }

      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
}

export async function updateReviewStatusFlow(
  deps: AdminDomainDependencies,
  reviewId: string,
  input: { status: ReviewModerationStatus; note?: string },
  adminUserId: string,
) {
  const existingReview = await deps.prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      business: true,
      customer: true,
    },
  });

  if (!existingReview) {
    throw new NotFoundException('Review not found');
  }

  const updatedReview = await deps.prisma.review.update({
    where: { id: reviewId },
    data: {
      status: deps.toReviewStatus(input.status),
    },
    include: {
      business: true,
      customer: true,
    },
  });

  await recordAdminAction(deps, {
    adminUserId,
    targetType: 'review',
    targetId: reviewId,
    action: `${input.status}_review`,
    note: input.note,
    extra: {
      previousStatus: deps.fromReviewStatus(existingReview.status),
    },
  });

  return deps.toAdminReviewQueueItem(updatedReview);
}

export async function getAdminConversationCasesFlow(
  deps: AdminDomainDependencies,
): Promise<AdminConversationCase[]> {
  const [conversations, actions] = await deps.prisma.$transaction([
    deps.prisma.conversation.findMany({
      include: {
        business: true,
        participants: {
          include: {
            user: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    }),
    deps.prisma.adminAction.findMany({
      where: {
        targetType: 'conversation',
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const latestActionByConversation = new Map<string, (typeof actions)[number]>();
  for (const action of actions) {
    if (!latestActionByConversation.has(action.targetId)) {
      latestActionByConversation.set(action.targetId, action);
    }
  }

  return conversations
    .map((conversation) => {
      const latestMessage = conversation.messages[0];
      const lastMessage =
        conversation.lastMessage ?? latestMessage?.content ?? 'No messages yet.';
      const lastMessageAt = (
        conversation.lastMessageAt ??
        latestMessage?.createdAt ??
        conversation.createdAt
      ).toISOString();
      const latestAction = latestActionByConversation.get(conversation.id);
      const caseStatus = deps.getConversationCaseStatus(latestAction?.action);

      return {
        id: conversation.id,
        businessId: conversation.businessId,
        businessName: conversation.business.name,
        bookingId: conversation.appointmentId ?? undefined,
        participantNames: conversation.participants.map(
          (participant) => participant.user.fullName,
        ),
        lastMessage,
        lastMessageAt,
        messageCount: conversation._count.messages,
        priority: deps.getConversationPriority(
          lastMessage,
          conversation.appointmentId ?? undefined,
        ),
        caseStatus,
      };
    })
    .sort((left, right) => {
      if (
        deps.conversationCaseStatusOrder[left.caseStatus] !==
        deps.conversationCaseStatusOrder[right.caseStatus]
      ) {
        return (
          deps.conversationCaseStatusOrder[left.caseStatus] -
          deps.conversationCaseStatusOrder[right.caseStatus]
        );
      }

      if (left.priority !== right.priority) {
        return left.priority === 'high' ? -1 : 1;
      }

      return Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt);
    });
}

export async function updateConversationCaseStatusFlow(
  deps: AdminDomainDependencies,
  conversationId: string,
  input: { status: AdminConversationCase['caseStatus']; note?: string },
  adminUserId: string,
) {
  const conversation = await deps.prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      business: true,
      participants: {
        include: {
          user: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundException('Conversation not found');
  }

  const action =
    input.status === 'watched'
      ? 'watch_conversation'
      : input.status === 'resolved'
        ? 'resolve_conversation'
        : 'reopen_conversation';

  await recordAdminAction(deps, {
    adminUserId,
    targetType: 'conversation',
    targetId: conversationId,
    action,
    note: input.note,
  });

  const latestMessage = conversation.messages[0];
  const lastMessage =
    conversation.lastMessage ?? latestMessage?.content ?? 'No messages yet.';

  return {
    id: conversation.id,
    businessId: conversation.businessId,
    businessName: conversation.business.name,
    bookingId: conversation.appointmentId ?? undefined,
    participantNames: conversation.participants.map(
      (participant) => participant.user.fullName,
    ),
    lastMessage,
    lastMessageAt: (
      conversation.lastMessageAt ??
      latestMessage?.createdAt ??
      conversation.createdAt
    ).toISOString(),
    messageCount: conversation._count.messages,
    priority: deps.getConversationPriority(
      lastMessage,
      conversation.appointmentId ?? undefined,
    ),
    caseStatus: input.status,
  };
}

export async function getAdminAuditActionsFlow(
  deps: AdminDomainDependencies,
) {
  const actions = await deps.prisma.adminAction.findMany({
    include: {
      admin: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return actions.map((action) => deps.toAdminActionRecord(action));
}

export async function getAdminOverviewFlow(
  deps: AdminDomainDependencies,
): Promise<AdminOverview> {
  const [
    users,
    businesses,
    activeBookings,
    openConversations,
    pendingReviews,
  ] = await deps.prisma.$transaction([
    deps.prisma.user.count(),
    deps.prisma.business.count({
      where: { status: BusinessStatus.APPROVED },
    }),
    deps.prisma.appointment.count({
      where: { status: { not: AppointmentStatus.CANCELLED } },
    }),
    deps.prisma.conversation.count(),
    deps.prisma.review.count({ where: { status: ReviewStatus.FLAGGED } }),
  ]);

  return {
    users,
    businesses,
    activeBookings,
    openConversations,
    pendingReviews,
  };
}

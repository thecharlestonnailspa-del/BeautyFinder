import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type {
  ConversationRecord,
  MessageRecord,
  UserSummary,
} from '@beauty-finder/types';
import { Prisma } from '@prisma/client';
import { toMessageRecord } from './marketplace-mappers.helpers';
import type { PrismaService } from '../prisma.service';

type MessagingClient = Prisma.TransactionClient | PrismaService;

type ConversationParticipantShape = {
  userId: string;
};

type ConversationMessageShape = {
  content: string;
  createdAt: Date;
};

type ConversationAccessShape = {
  participants: ConversationParticipantShape[];
};

type ConversationSummaryShape = ConversationAccessShape & {
  id: string;
  businessId: string;
  appointmentId: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  messages: ConversationMessageShape[];
};

export type MessagingDomainDependencies = {
  prisma: PrismaService;
  resolveScopedUserId: (
    actor: UserSummary,
    requestedUserId?: string,
  ) => string;
  createNotification: (
    client: Prisma.TransactionClient,
    input: {
      userId: string;
      type: 'message_received';
      title: string;
      body?: string;
      payload?: Record<string, unknown>;
      createdAt?: Date;
    },
  ) => Promise<unknown>;
};

async function getConversationForActor(
  deps: MessagingDomainDependencies,
  conversationId: string,
  actor: UserSummary,
  client: MessagingClient = deps.prisma,
): Promise<ConversationAccessShape> {
  const conversation = await client.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });

  if (!conversation) {
    throw new NotFoundException('Conversation not found');
  }

  if (
    actor.role !== 'admin' &&
    !conversation.participants.some(
      (participant) => participant.userId === actor.id,
    )
  ) {
    throw new ForbiddenException('You do not have access to this conversation');
  }

  return conversation;
}

export async function getConversationsFlow(
  deps: MessagingDomainDependencies,
  actor: UserSummary,
  requestedUserId?: string,
): Promise<ConversationRecord[]> {
  const userId = deps.resolveScopedUserId(actor, requestedUserId);

  const conversations: ConversationSummaryShape[] =
    await deps.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

  return conversations.map((conversation) => {
    const latestMessage = conversation.messages[0];

    return {
      id: conversation.id,
      businessId: conversation.businessId,
      bookingId: conversation.appointmentId ?? undefined,
      participantIds: conversation.participants.map(
        (participant) => participant.userId,
      ),
      lastMessage: conversation.lastMessage ?? latestMessage?.content ?? '',
      lastMessageAt: (
        conversation.lastMessageAt ??
        latestMessage?.createdAt ??
        conversation.createdAt
      ).toISOString(),
    };
  });
}

export async function getMessagesFlow(
  deps: MessagingDomainDependencies,
  conversationId: string,
  actor: UserSummary,
): Promise<MessageRecord[]> {
  await getConversationForActor(deps, conversationId, actor);

  const messages = await deps.prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map((message) => toMessageRecord(message));
}

export async function createMessageFlow(
  deps: MessagingDomainDependencies,
  conversationId: string,
  senderId: string,
  body: string,
  actor: UserSummary,
): Promise<MessageRecord> {
  if (senderId !== actor.id) {
    throw new ForbiddenException('You can only send messages as yourself');
  }

  const message = await deps.prisma.$transaction(async (tx) => {
    const conversation = await getConversationForActor(
      deps,
      conversationId,
      actor,
      tx,
    );
    const actorIsParticipant = conversation.participants.some(
      (participant) => participant.userId === actor.id,
    );

    if (!actorIsParticipant) {
      throw new ForbiddenException('Sender is not part of this conversation');
    }

    const createdMessage = await tx.message.create({
      data: {
        conversationId,
        senderUserId: actor.id,
        content: body,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: body,
        lastMessageAt: createdMessage.createdAt,
      },
    });

    const recipientId = conversation.participants.find(
      (participant) => participant.userId !== actor.id,
    )?.userId;

    if (recipientId) {
      await deps.createNotification(tx, {
        userId: recipientId,
        type: 'message_received',
        title: 'New message',
        body,
        createdAt: createdMessage.createdAt,
      });
    }

    return createdMessage;
  });

  return toMessageRecord(message);
}

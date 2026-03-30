import { Injectable } from '@nestjs/common';
import type { UserSummary } from '@beauty-finder/types';
import { createMessageSchema } from '@beauty-finder/validation';
import { MarketplaceService } from '../../common/marketplace.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagingService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getConversations(actor: UserSummary, userId?: string) {
    return this.marketplace.getConversations(actor, userId);
  }

  getMessages(conversationId: string, actor: UserSummary) {
    return this.marketplace.getMessages(conversationId, actor);
  }

  createMessage(
    conversationId: string,
    input: CreateMessageDto,
    actor: UserSummary,
  ) {
    const parsed = createMessageSchema.parse(input);
    return this.marketplace.createMessage(
      conversationId,
      parsed.senderId,
      parsed.body,
      actor,
    );
  }
}

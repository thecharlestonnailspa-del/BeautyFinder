import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { MessagingService } from './messaging.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  getConversations(
    @Query('userId') userId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messagingService.getConversations(
      request.session!.user,
      userId,
    );
  }

  @Get('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  getMessages(
    @Param('conversationId') conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messagingService.getMessages(
      conversationId,
      request.session!.user,
    );
  }

  @Post('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  createMessage(
    @Param('conversationId') conversationId: string,
    @Body() input: CreateMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messagingService.createMessage(
      conversationId,
      input,
      request.session!.user,
    );
  }
}

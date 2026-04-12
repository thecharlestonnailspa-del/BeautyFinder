import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ServicesModule } from './modules/services/services.module';
import { StaffModule } from './modules/staff/staff.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { CustomerInsightsModule } from './modules/customer-insights/customer-insights.module';
import { SearchModule } from './modules/search/search.module';
import { TechniciansModule } from './modules/technicians/technicians.module';

@Module({
  imports: [
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    CategoriesModule,
    ServicesModule,
    StaffModule,
    AvailabilityModule,
    BookingsModule,
    MessagingModule,
    ReviewsModule,
    FavoritesModule,
    NotificationsModule,
    PaymentsModule,
    AdminModule,
    AuditModule,
    CustomerInsightsModule,
    SearchModule,
    TechniciansModule,
  ],
})
export class AppModule {}

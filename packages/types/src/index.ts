export type Role = 'customer' | 'owner' | 'technician' | 'admin';
export type ProfessionalAccountType = 'salon_owner' | 'private_technician';
export type ProfessionalVerificationStatus = 'pending_review' | 'approved' | 'rejected';
export type UserStatus = 'active' | 'pending' | 'suspended' | 'deleted';
export type BusinessCategory = 'nail' | 'hair';
export type BusinessModerationStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended';
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type ReviewModerationStatus = 'published' | 'hidden' | 'flagged';
export type AdminConversationCaseStatus = 'open' | 'watched' | 'resolved';
export type AdminConversationPriority = 'normal' | 'high';
export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'message_received'
  | 'payment_receipt'
  | 'review_received'
  | 'system';
export type PaymentMethod = 'card' | 'cash';
export type PaymentStatus = 'paid' | 'refunded';
export type AdPlacement = 'homepage_spotlight' | 'category_boost' | 'city_boost';
export type AdPaymentStatus = 'pending_payment' | 'discounted' | 'paid' | 'cancelled';
export type PrivateTechnicianProfileStatus = 'draft' | 'published' | 'suspended';
export type PrivateTechnicianAdStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface UserSummary {
  id: string;
  role: Role;
  name: string;
  email: string;
  publicId?: string;
  accountType?: ProfessionalAccountType;
  avatarUrl?: string;
}

export interface AdminAccessContext {
  adminUserId: string;
  adminName: string;
  startedAt: string;
  note?: string;
}

export interface ServiceSummary {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface OwnerServiceSummary extends ServiceSummary {
  businessId: string;
  description?: string;
  isActive: boolean;
}

export interface StaffSummary {
  id: string;
  businessId: string;
  userId?: string;
  name: string;
  title?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface PromotionSummary {
  title: string;
  description?: string;
  discountPercent: number;
  code?: string;
  expiresAt?: string;
}

export interface BusinessSummary {
  id: string;
  publicId?: string;
  ownerId: string;
  category: BusinessCategory;
  name: string;
  featuredOnHomepage: boolean;
  homepageRank: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  reviewCount: number;
  heroImage: string;
  description: string;
  services: ServiceSummary[];
}

export interface OwnerBusinessProfile extends Omit<
  BusinessSummary,
  'services'
> {
  status: BusinessModerationStatus;
  businessLogo?: string;
  businessBanner?: string;
  ownerAvatar?: string;
  services: OwnerServiceSummary[];
  galleryImages: string[];
  videoUrl?: string;
  staff: StaffSummary[];
  promotion?: PromotionSummary;
}

export interface PrivateTechnicianServiceRecord {
  id: string;
  userId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface PrivateTechnicianAdRecord {
  id: string;
  userId: string;
  campaignName: string;
  placement: AdPlacement;
  headline: string;
  description?: string;
  destinationUrl?: string;
  budget: number;
  currency: string;
  status: PrivateTechnicianAdStatus;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateTechnicianProfileRecord {
  userId: string;
  accountType: 'private_technician';
  verificationStatus: ProfessionalVerificationStatus;
  status: PrivateTechnicianProfileStatus;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  displayName: string;
  category: BusinessCategory;
  headline?: string;
  bio?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  heroImage?: string;
  featuredOnHomepage: boolean;
  homepageRank: number;
  services: PrivateTechnicianServiceRecord[];
  ads: PrivateTechnicianAdRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface OwnerTechnicianProfile extends StaffSummary {
  businessName: string;
  businessCategory: BusinessCategory;
  businessStatus: BusinessModerationStatus;
}

export interface OwnerServiceInput {
  id?: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface OwnerStaffInput {
  id?: string;
  name: string;
  title?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface OwnerTechnicianInput {
  id?: string;
  userId?: string;
  name: string;
  title?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface OwnerTechnicianRosterUpdateInput {
  technicians: OwnerTechnicianInput[];
}

export interface OwnerBusinessUpdateInput {
  name?: string;
  description?: string;
  heroImage?: string;
  businessLogo?: string;
  businessBanner?: string;
  ownerAvatar?: string;
  galleryImages?: string[];
  videoUrl?: string;
  promotion?: PromotionSummary | null;
  services?: OwnerServiceInput[];
  staff?: OwnerStaffInput[];
}

export interface RegisterBusinessOwnerInput {
  ownerName: string;
  ownerEmail: string;
  password: string;
  ownerPhone?: string;
  businessName: string;
  category: BusinessCategory;
  description?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  businessPhone?: string;
  businessEmail?: string;
  salonLicenseNumber: string;
  businessLicenseNumber: string;
  einNumber: string;
}

export interface RegisterPrivateTechnicianInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  category?: BusinessCategory;
  headline?: string;
  bio?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  heroImage?: string;
  identityCardNumber: string;
  ssaNumber: string;
  licenseNumber: string;
  licenseState: string;
}

export interface PrivateTechnicianServiceInput {
  id?: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface UpdatePrivateTechnicianProfileInput {
  displayName?: string;
  category?: BusinessCategory;
  headline?: string;
  bio?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  heroImage?: string;
  featuredOnHomepage?: boolean;
  homepageRank?: number;
  services?: PrivateTechnicianServiceInput[];
}

export interface CreatePrivateTechnicianAdInput {
  campaignName: string;
  placement: AdPlacement;
  headline: string;
  description?: string;
  destinationUrl?: string;
  budget: number;
  startsAt?: string;
  endsAt?: string;
  status?: PrivateTechnicianAdStatus;
}

export interface UpdatePrivateTechnicianAdInput {
  campaignName?: string;
  headline?: string;
  description?: string;
  destinationUrl?: string;
  budget?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: PrivateTechnicianAdStatus;
}

export interface BookingRecord {
  id: string;
  customerId: string;
  ownerId: string;
  businessId: string;
  serviceId: string;
  serviceName: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  note?: string;
}

export interface ReviewRecord {
  id: string;
  appointmentId?: string;
  businessId: string;
  customerId: string;
  customerName: string;
  customerAvatarUrl?: string;
  rating: number;
  comment: string;
  imageUrls: string[];
  createdAt: string;
}

export interface CreateReviewInput {
  businessId: string;
  appointmentId?: string;
  rating: number;
  comment?: string;
  imageUrls?: string[];
  customerAvatarUrl?: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  businessId: string;
  bookingId?: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationPreferenceRecord {
  userId: string;
  bookingCreated: boolean;
  bookingConfirmed: boolean;
  messageReceived: boolean;
  paymentReceipt: boolean;
  reviewReceived: boolean;
  system: boolean;
  updatedAt: string;
}

export interface NotificationPreferenceInput {
  bookingCreated?: boolean;
  bookingConfirmed?: boolean;
  messageReceived?: boolean;
  paymentReceipt?: boolean;
  reviewReceived?: boolean;
  system?: boolean;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  customerId: string;
  ownerId: string;
  businessId: string;
  serviceId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  currency: string;
  receiptNumber: string;
  cardBrand?: string;
  cardLast4?: string;
  paidAt: string;
  createdAt: string;
}

export interface AdPricingRecord {
  placement: AdPlacement;
  label: string;
  dailyPrice: number;
  monthlyPrice: number;
  currency: string;
  note?: string;
  updatedAt: string;
  updatedByUserId?: string;
}

export interface UpdateAdPricingInput {
  dailyPrice: number;
  monthlyPrice: number;
  note?: string;
}

export interface CheckoutPaymentInput {
  bookingId: string;
  method: PaymentMethod;
  tipAmount?: number;
  cardBrand?: string;
  cardLast4?: string;
}

export interface AdminOverview {
  users: number;
  businesses: number;
  activeBookings: number;
  openConversations: number;
  pendingReviews: number;
}

export interface AdminBusinessQueueItem {
  id: string;
  publicId?: string;
  ownerId: string;
  ownerPublicId?: string;
  ownerName: string;
  ownerEmail: string;
  category: BusinessCategory;
  name: string;
  status: BusinessModerationStatus;
  featuredOnHomepage: boolean;
  homepageRank: number;
  city: string;
  state: string;
  createdAt: string;
}

export interface AdminReviewQueueItem {
  id: string;
  appointmentId?: string;
  businessId: string;
  businessPublicId?: string;
  businessName: string;
  customerId: string;
  customerPublicId?: string;
  customerName: string;
  rating: number;
  comment: string;
  status: ReviewModerationStatus;
  createdAt: string;
}

export interface AdminConversationCase {
  id: string;
  businessId: string;
  businessName: string;
  bookingId?: string;
  participantNames: string[];
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  priority: AdminConversationPriority;
  caseStatus: AdminConversationCaseStatus;
}

export interface AdminActionRecord {
  id: string;
  adminUserId: string;
  adminName: string;
  targetType: string;
  targetId: string;
  action: string;
  metadata?: string;
  createdAt: string;
}

export interface AdminAccountSummary {
  id: string;
  publicId?: string;
  name: string;
  email: string;
  phone?: string;
  status: UserStatus;
  roles: Role[];
  primaryRole: Role;
  accountType?: ProfessionalAccountType;
  businessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccountUpdateInput {
  name?: string;
  email?: string;
  phone?: string | null;
  status?: UserStatus;
}

export interface PreferenceScore {
  label: string;
  score: number;
}

export interface CustomerPreferenceProfileRecord {
  customerId: string;
  customerName: string;
  customerEmail: string;
  favoriteColors: PreferenceScore[];
  topServices: PreferenceScore[];
  topCategories: PreferenceScore[];
  preferredExperience: string;
  averageBusinessPageDwellSeconds: number;
  totalBusinessPageViews: number;
  totalFavoriteBusinesses: number;
  totalBookings: number;
  engagementScore: number;
  lastSeenAt?: string;
}

export interface CustomerPreferenceReportRecord {
  generatedAt: string;
  totalCustomers: number;
  totalTrackedPageViews: number;
  colorTrends: PreferenceScore[];
  serviceTrends: PreferenceScore[];
  experienceTrends: PreferenceScore[];
  customers: CustomerPreferenceProfileRecord[];
}

export interface OwnerBusinessAudienceRecord {
  businessId: string;
  businessName: string;
  uniqueViewers: number;
  totalPageViews: number;
  averageDwellSeconds: number;
  lastViewedAt?: string;
}

export interface OwnerAudienceReportRecord {
  generatedAt: string;
  totalUniqueViewers: number;
  totalPageViews: number;
  businessesWithViews: number;
  businesses: OwnerBusinessAudienceRecord[];
}

export interface RecordBusinessPageViewInput {
  selectedServiceId?: string;
  selectedServiceName?: string;
  note?: string;
  dwellSeconds: number;
  colorSignals?: string[];
  source?: string;
}

export interface SessionPayload {
  user: UserSummary;
  permissions: string[];
  accessToken: string;
  expiresAt: string;
  adminAccess?: AdminAccessContext;
}

export interface CategorySummary {
  id: BusinessCategory;
  label: string;
  businessCount: number;
}

export interface AvailabilitySlotSummary {
  id: string;
  businessId: string;
  serviceId: string;
  staffName: string;
  startAt: string;
  endAt: string;
  isBooked: boolean;
}

export interface FavoriteRecord {
  userId: string;
  businessId: string;
  createdAt: string;
}

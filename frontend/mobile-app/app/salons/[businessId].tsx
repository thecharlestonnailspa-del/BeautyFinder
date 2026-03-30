import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  AvailabilitySlotSummary,
  BookingRecord,
  BusinessSummary,
  CreateReviewInput,
  PaymentRecord,
  RecordBusinessPageViewInput,
  ReviewRecord,
} from '@beauty-finder/types';
import { BeautyMotion } from '../../src/components/beauty-motion';
import { BusinessMapCard } from '../../src/components/business-map-card';
import {
  fallbackFavoriteIds,
  FavoriteWithBusiness,
  fetchJson,
  formatBusinessAddress,
  getCurrentCustomerAvatarUrl,
  getApiBaseUrl,
  getApiUnavailableMessage,
  getAuthHeaders,
  getBusinessById,
  getCurrentCustomerId,
  getFallbackAvailabilityForBusiness,
  getFallbackReviewsForBusiness,
} from '../../src/lib/customer-experience';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function formatSlotRange(slot: AvailabilitySlotSummary) {
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);

  return `${start.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })} · ${start.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function sortSlots(slots: AvailabilitySlotSummary[]) {
  return [...slots].sort(
    (left, right) =>
      new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderRatingStars(rating: number) {
  return `${'★'.repeat(Math.max(0, Math.min(5, rating)))}${'☆'.repeat(
    Math.max(0, 5 - rating),
  )}`;
}

function extractColorSignalsFromNote(note: string) {
  const normalized = note.toLowerCase();
  const keywords = [
    'pink',
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'brown',
    'black',
    'white',
    'neutral',
    'nude',
    'beige',
    'taupe',
    'gold',
    'silver',
    'chrome',
    'pastel',
    'coral',
    'peach',
  ];

  return keywords.filter((keyword) => normalized.includes(keyword));
}

export default function SalonDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string | string[] }>();
  const businessId = normalizeParam(params.businessId);
  const currentCustomerId = getCurrentCustomerId();
  const currentCustomerAvatarUrl = getCurrentCustomerAvatarUrl();
  const fallbackBusiness = getBusinessById(businessId);

  const [business, setBusiness] = useState<BusinessSummary | null>(
    fallbackBusiness,
  );
  const [availability, setAvailability] = useState<AvailabilitySlotSummary[]>(
    fallbackBusiness
      ? getFallbackAvailabilityForBusiness(fallbackBusiness.id)
      : [],
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>(fallbackFavoriteIds);
  const [selectedServiceId, setSelectedServiceId] = useState(
    fallbackBusiness?.services[0]?.id ?? '',
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [statusText, setStatusText] = useState('Loading salon details...');
  const [loading, setLoading] = useState(true);
  const [bookingPending, setBookingPending] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [reviews, setReviews] = useState<ReviewRecord[]>(
    getFallbackReviewsForBusiness(businessId),
  );
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewAvatarUrl, setReviewAvatarUrl] = useState(
    currentCustomerAvatarUrl ?? '',
  );
  const [reviewImageUrls, setReviewImageUrls] = useState<string[]>(['']);
  const [latestBooking, setLatestBooking] = useState<BookingRecord | null>(
    null,
  );
  const [latestPayment, setLatestPayment] = useState<PaymentRecord | null>(
    null,
  );
  const pageViewStartedAtRef = useRef<number | null>(null);
  const selectedServiceRef = useRef<{ id?: string; name?: string } | null>(null);
  const noteRef = useRef('');

  useEffect(() => {
    let active = true;

    async function loadBusiness() {
      if (!businessId) {
        setLoading(false);
        setStatusText('Salon details are missing.');
        return;
      }

      const [nextBusiness, favoriteRecords] = await Promise.all([
        fetchJson<BusinessSummary>(`/businesses/${businessId}`),
        currentCustomerId
          ? fetchJson<FavoriteWithBusiness[]>('/favorites', {
              headers: getAuthHeaders(),
            })
          : Promise.resolve(null),
      ]);

      if (!active) {
        return;
      }

      const resolvedBusiness = nextBusiness ?? fallbackBusiness;
      if (!resolvedBusiness) {
        setBusiness(null);
        setLoading(false);
        setStatusText('We could not find this salon.');
        return;
      }

      setBusiness(resolvedBusiness);
      setFavoriteIds(
        favoriteRecords?.map((favorite) => favorite.businessId) ??
          (currentCustomerId ? fallbackFavoriteIds : []),
      );

      setSelectedServiceId((current) => {
        if (
          current &&
          resolvedBusiness.services.some((service) => service.id === current)
        ) {
          return current;
        }

        return resolvedBusiness.services[0]?.id ?? '';
      });

      setStatusText(
        nextBusiness
          ? 'Live salon details loaded.'
          : 'Using sweet offline salon details.',
      );
      setLoading(false);
    }

    void loadBusiness();

    return () => {
      active = false;
    };
  }, [businessId, currentCustomerId, fallbackBusiness]);

  useEffect(() => {
    let active = true;

    async function loadAvailability() {
      if (!businessId || !selectedServiceId) {
        setAvailability([]);
        setSelectedSlotId(null);
        return;
      }

      const nextAvailability = await fetchJson<AvailabilitySlotSummary[]>(
        `/availability?businessId=${businessId}&serviceId=${selectedServiceId}`,
      );

      if (!active) {
        return;
      }

      const resolvedAvailability = sortSlots(
        nextAvailability ??
          getFallbackAvailabilityForBusiness(businessId, selectedServiceId),
      );

      setAvailability(resolvedAvailability);
      setSelectedSlotId((current) => {
        const currentStillExists = current
          ? resolvedAvailability.some(
              (slot) => slot.id === current && !slot.isBooked,
            )
          : false;

        if (currentStillExists) {
          return current;
        }

        return resolvedAvailability.find((slot) => !slot.isBooked)?.id ?? null;
      });
    }

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [businessId, selectedServiceId]);

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      if (!businessId) {
        setReviews([]);
        return;
      }

      const nextReviews = await fetchJson<ReviewRecord[]>(
        `/reviews?businessId=${businessId}`,
      );

      if (!active) {
        return;
      }

      setReviews(nextReviews ?? getFallbackReviewsForBusiness(businessId));
    }

    void loadReviews();

    return () => {
      active = false;
    };
  }, [businessId]);

  const selectedService = useMemo(
    () =>
      business?.services.find((service) => service.id === selectedServiceId) ??
      null,
    [business, selectedServiceId],
  );

  const selectedSlot = useMemo(
    () => availability.find((slot) => slot.id === selectedSlotId) ?? null,
    [availability, selectedSlotId],
  );

  useEffect(() => {
    selectedServiceRef.current = selectedService
      ? { id: selectedService.id, name: selectedService.name }
      : null;
  }, [selectedService]);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    if (currentCustomerAvatarUrl) {
      setReviewAvatarUrl((current) => current || currentCustomerAvatarUrl);
    }
  }, [currentCustomerAvatarUrl]);

  useEffect(() => {
    if (!businessId || !business) {
      return;
    }

    const trackedBusinessId = business.id;
    pageViewStartedAtRef.current = Date.now();

    return () => {
      const startedAt = pageViewStartedAtRef.current;
      const apiBaseUrl = getApiBaseUrl();
      if (!startedAt || !currentCustomerId || !apiBaseUrl) {
        return;
      }

      const dwellSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      );

      if (dwellSeconds < 4) {
        return;
      }

      const activeService = selectedServiceRef.current;
      const currentNote = noteRef.current.trim();
      const payload: RecordBusinessPageViewInput = {
        selectedServiceId: activeService?.id,
        selectedServiceName: activeService?.name,
        note: currentNote || undefined,
        dwellSeconds,
        colorSignals: extractColorSignalsFromNote(currentNote),
        source: 'mobile_salon_detail',
      };

      void fetch(`${apiBaseUrl}/customer-insights/businesses/${trackedBusinessId}/page-view`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    };
  }, [business?.id, businessId, currentCustomerId]);

  const availableSlots = availability.filter((slot) => !slot.isBooked);
  const isFavorite = business ? favoriteIds.includes(business.id) : false;

  async function toggleFavorite() {
    if (!business || favoritePending) {
      return;
    }

    if (!currentCustomerId) {
      setStatusText('Log in to save salons to your favorites.');
      router.push({ pathname: '/auth', params: { mode: 'login' } });
      return;
    }

    const apiBaseUrl = getApiBaseUrl();

    if (!apiBaseUrl) {
      setStatusText(getApiUnavailableMessage());
      return;
    }

    setFavoritePending(true);

    try {
      const response = await fetch(`${apiBaseUrl}/favorites/${business.id}`, {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setStatusText('Favorite update did not stick. Try again.');
        return;
      }

      const nextFavorites = (await response.json()) as FavoriteWithBusiness[];
      setFavoriteIds(nextFavorites.map((favorite) => favorite.businessId));
      setStatusText(
        isFavorite
          ? 'Removed from your ribbon picks.'
          : 'Saved to your ribbon picks.',
      );
    } catch {
      setStatusText('Could not reach the API for favorites.');
    } finally {
      setFavoritePending(false);
    }
  }

  async function handleBooking() {
    if (!currentCustomerId) {
      setStatusText('Log in to book this salon.');
      router.push({ pathname: '/auth', params: { mode: 'login' } });
      return;
    }

    if (!business || !selectedService || !selectedSlot || bookingPending) {
      setStatusText('Pick a service and an open time before booking.');
      return;
    }

    const apiBaseUrl = getApiBaseUrl();

    if (!apiBaseUrl) {
      setStatusText(getApiUnavailableMessage());
      return;
    }

    setBookingPending(true);
    setLatestPayment(null);
    setStatusText('Sending your booking ribbon...');

    try {
      const response = await fetch(`${apiBaseUrl}/bookings`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          customerId: currentCustomerId,
          ownerId: business.ownerId,
          businessId: business.id,
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
          note: note.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let message = 'Booking could not be created.';

        try {
          const errorBody = (await response.json()) as {
            message?: string | string[];
          };
          if (typeof errorBody.message === 'string') {
            message = errorBody.message;
          } else if (Array.isArray(errorBody.message) && errorBody.message[0]) {
            message = errorBody.message[0];
          }
        } catch {
          // keep the generic message
        }

        setStatusText(message);
        return;
      }

      const createdBooking = (await response.json()) as BookingRecord;
      setLatestBooking(createdBooking);
      setStatusText('Booking saved. Processing secure checkout...');

      const paymentResponse = await fetch(`${apiBaseUrl}/payments/checkout`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          bookingId: createdBooking.id,
          method: 'card',
          cardBrand: 'Visa',
          cardLast4: '4242',
        }),
      });

      if (!paymentResponse.ok) {
        let message = 'The booking was saved, but payment did not complete.';

        try {
          const errorBody = (await paymentResponse.json()) as {
            message?: string | string[];
          };
          if (typeof errorBody.message === 'string') {
            message = errorBody.message;
          } else if (Array.isArray(errorBody.message) && errorBody.message[0]) {
            message = errorBody.message[0];
          }
        } catch {
          // keep the generic message
        }

        setStatusText(message);
        return;
      }

      const createdPayment = (await paymentResponse.json()) as PaymentRecord;
      setLatestPayment(createdPayment);
      setNote('');
      setStatusText(
        `Appointment booked and paid. Receipt ${createdPayment.receiptNumber}.`,
      );

      const nextAvailability = await fetchJson<AvailabilitySlotSummary[]>(
        `/availability?businessId=${business.id}&serviceId=${selectedService.id}`,
      );

      const resolvedAvailability = sortSlots(
        nextAvailability ??
          getFallbackAvailabilityForBusiness(business.id, selectedService.id),
      );

      setAvailability(resolvedAvailability);
      setSelectedSlotId(
        resolvedAvailability.find((slot) => !slot.isBooked)?.id ?? null,
      );
    } catch {
      setStatusText('Could not reach the API to create the booking.');
    } finally {
      setBookingPending(false);
    }
  }

  async function handleSubmitReview() {
    if (reviewPending || !business) {
      return;
    }

    if (!currentCustomerId) {
      setStatusText('Log in to leave a review.');
      router.push({ pathname: '/auth', params: { mode: 'login' } });
      return;
    }

    const trimmedComment = reviewComment.trim();
    const nextImageUrls = reviewImageUrls.map((value) => value.trim()).filter(Boolean);

    if (!trimmedComment && nextImageUrls.length === 0) {
      setStatusText('Add a comment or at least 1 review image URL.');
      return;
    }

    const apiBaseUrl = getApiBaseUrl();

    if (!apiBaseUrl) {
      setStatusText(getApiUnavailableMessage());
      return;
    }

    setReviewPending(true);
    setStatusText('Publishing your review ribbon...');

    const payload: CreateReviewInput = {
      businessId: business.id,
      appointmentId:
        latestBooking?.businessId === business.id ? latestBooking.id : undefined,
      rating: reviewRating,
      comment: trimmedComment || undefined,
      imageUrls: nextImageUrls,
      customerAvatarUrl: reviewAvatarUrl.trim() || undefined,
    };

    try {
      const response = await fetch(`${apiBaseUrl}/reviews`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = 'Review could not be published.';

        try {
          const errorBody = (await response.json()) as {
            detail?: string;
            message?: string | string[];
          };
          if (typeof errorBody.detail === 'string') {
            message = errorBody.detail;
          } else if (typeof errorBody.message === 'string') {
            message = errorBody.message;
          } else if (Array.isArray(errorBody.message) && errorBody.message[0]) {
            message = errorBody.message[0];
          }
        } catch {
          // Keep the default message.
        }

        setStatusText(message);
        return;
      }

      const createdReview = (await response.json()) as ReviewRecord;
      setReviews((current) => [createdReview, ...current]);
      setReviewComment('');
      setReviewImageUrls(['']);
      setStatusText('Review published with your latest photos.');

      const refreshedBusiness = await fetchJson<BusinessSummary>(
        `/businesses/${business.id}`,
      );
      if (refreshedBusiness) {
        setBusiness(refreshedBusiness);
      }
    } catch {
      setStatusText('Could not reach the review endpoint right now.');
    } finally {
      setReviewPending(false);
    }
  }

  if (!business) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: 'Salon details' }} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Salon not found</Text>
          <Text style={styles.emptyBody}>
            This beauty spot is missing from the local data right now.
          </Text>
          <Pressable
            onPress={() => {
              router.replace('/');
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.primaryButtonPressed : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>Back to home</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: business.name }} />

      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{business.category}</Text>
          </View>
          <Pressable
            onPress={toggleFavorite}
            style={({ pressed }) => [
              styles.favoriteButton,
              isFavorite ? styles.favoriteButtonActive : null,
              pressed ? styles.favoriteButtonPressed : null,
            ]}
          >
            <Text style={styles.favoriteButtonText}>
              {favoritePending ? 'Saving...' : isFavorite ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.heroTitle}>{business.name}</Text>
        <Text style={styles.heroMeta}>
          {business.rating} / 5 · {business.reviewCount} reviews
        </Text>
        <Text style={styles.heroAddress}>
          {formatBusinessAddress(business)}
        </Text>
        <Text style={styles.heroBody}>{business.description}</Text>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <BeautyMotion variant="loading" size={78} />
          <View style={styles.loadingCopy}>
            <Text style={styles.loadingTitle}>Loading salon ribbons...</Text>
            <Text style={styles.loadingText}>
              Pulling live details, saved picks, and the freshest open slots.
            </Text>
          </View>
        </View>
      ) : null}

      <BusinessMapCard
        business={business}
        height={260}
        title="Visit this salon"
        subtitle="Preview the route before you lock your appointment."
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Services</Text>
        <Text style={styles.sectionTitle}>Choose your beauty menu</Text>
        <View style={styles.chipWrap}>
          {business.services.map((service) => {
            const selected = service.id === selectedServiceId;

            return (
              <Pressable
                key={service.id}
                onPress={() => {
                  setSelectedServiceId(service.id);
                }}
                style={({ pressed }) => [
                  styles.serviceChip,
                  selected ? styles.serviceChipSelected : null,
                  pressed ? styles.serviceChipPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.serviceChipName,
                    selected ? styles.serviceChipNameSelected : null,
                  ]}
                >
                  {service.name}
                </Text>
                <Text
                  style={[
                    styles.serviceChipMeta,
                    selected ? styles.serviceChipMetaSelected : null,
                  ]}
                >
                  {service.durationMinutes} min · ${service.price}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Availability</Text>
        <Text style={styles.sectionTitle}>Pick a ribbon slot</Text>
        {availableSlots.length === 0 ? (
          <View style={styles.emptySectionCard}>
            <Text style={styles.emptySectionTitle}>No open times yet</Text>
            <Text style={styles.emptySectionBody}>
              Try another service or check back after the owner opens more
              slots.
            </Text>
          </View>
        ) : (
          <View style={styles.slotList}>
            {availability.map((slot) => {
              const selected = slot.id === selectedSlotId;
              const disabled = slot.isBooked;

              return (
                <Pressable
                  key={slot.id}
                  disabled={disabled}
                  onPress={() => {
                    setSelectedSlotId(slot.id);
                  }}
                  style={({ pressed }) => [
                    styles.slotCard,
                    selected ? styles.slotCardSelected : null,
                    disabled ? styles.slotCardDisabled : null,
                    pressed && !disabled ? styles.slotCardPressed : null,
                  ]}
                >
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotTitle}>
                      {formatSlotRange(slot)}
                    </Text>
                    <Text style={styles.slotBadge}>
                      {disabled ? 'Booked' : selected ? 'Selected' : 'Open'}
                    </Text>
                  </View>
                  <Text style={styles.slotMeta}>
                    Stylist · {slot.staffName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Booking note</Text>
        <Text style={styles.sectionTitle}>Add a small preference</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Ex: soft pink palette, quick trim, extra shine..."
          placeholderTextColor="#b1849d"
          multiline
          style={styles.noteInput}
        />

        <View style={styles.checkoutCard}>
          <Text style={styles.checkoutTitle}>Booking summary</Text>
          <Text style={styles.checkoutLine}>
            Service · {selectedService?.name ?? 'Choose a service'}
          </Text>
          <Text style={styles.checkoutLine}>
            Time ·{' '}
            {selectedSlot
              ? formatSlotRange(selectedSlot)
              : 'Choose an open slot'}
          </Text>
          <Text style={styles.checkoutLine}>
            Payment · Demo Visa ending in 4242 charged after the slot is held
          </Text>
          <Text style={styles.checkoutLine}>
            Estimated subtotal ·{' '}
            {selectedService
              ? formatCurrency(selectedService.price)
              : 'Choose a service'}
          </Text>

          <Pressable
            onPress={handleBooking}
            style={({ pressed }) => [
              styles.primaryButton,
              !selectedService || !selectedSlot || bookingPending
                ? styles.primaryButtonDisabled
                : null,
              pressed ? styles.primaryButtonPressed : null,
            ]}
            disabled={!selectedService || !selectedSlot || bookingPending}
          >
            <Text style={styles.primaryButtonText}>
              {bookingPending ? 'Booking...' : 'Book and pay'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Customer review</Text>
        <Text style={styles.sectionTitle}>Leave a glow note with photos</Text>

        <View style={styles.reviewComposerCard}>
          <Text style={styles.reviewComposerLabel}>Your rating</Text>
          <View style={styles.reviewRatingRow}>
            {[1, 2, 3, 4, 5].map((value) => {
              const selected = value === reviewRating;

              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    setReviewRating(value);
                  }}
                  style={({ pressed }) => [
                    styles.reviewRatingChip,
                    selected ? styles.reviewRatingChipSelected : null,
                    pressed ? styles.reviewRatingChipPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.reviewRatingChipText,
                      selected ? styles.reviewRatingChipTextSelected : null,
                    ]}
                  >
                    {value}★
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.reviewComposerLabel}>Avatar URL</Text>
          <TextInput
            value={reviewAvatarUrl}
            onChangeText={setReviewAvatarUrl}
            placeholder="https://images.example.com/ava.jpg"
            placeholderTextColor="#b1849d"
            style={styles.reviewInput}
          />

          <Text style={styles.reviewComposerLabel}>Review comment</Text>
          <TextInput
            value={reviewComment}
            onChangeText={setReviewComment}
            placeholder="Tell future clients how the service felt, looked, and lasted..."
            placeholderTextColor="#b1849d"
            multiline
            style={styles.reviewTextarea}
          />

          <View style={styles.reviewImagesHeader}>
            <Text style={styles.reviewComposerLabel}>Review image URLs</Text>
            <Pressable
              onPress={() => {
                setReviewImageUrls((current) => [...current, '']);
              }}
              style={({ pressed }) => [
                styles.reviewAddImageButton,
                pressed ? styles.reviewAddImageButtonPressed : null,
              ]}
            >
              <Text style={styles.reviewAddImageButtonText}>Add image URL</Text>
            </Pressable>
          </View>

          <View style={styles.reviewImageInputList}>
            {reviewImageUrls.map((value, index) => (
              <View key={`review-image-${index}`} style={styles.reviewImageInputRow}>
                <TextInput
                  value={value}
                  onChangeText={(nextValue) => {
                    setReviewImageUrls((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? nextValue : item,
                      ),
                    );
                  }}
                  placeholder="https://images.example.com/set-photo.jpg"
                  placeholderTextColor="#b1849d"
                  style={[styles.reviewInput, styles.reviewImageUrlInput]}
                />
                <Pressable
                  onPress={() => {
                    setReviewImageUrls((current) =>
                      current.length <= 1
                        ? ['']
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    );
                  }}
                  style={({ pressed }) => [
                    styles.reviewRemoveImageButton,
                    pressed ? styles.reviewRemoveImageButtonPressed : null,
                  ]}
                >
                  <Text style={styles.reviewRemoveImageButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            onPress={handleSubmitReview}
            style={({ pressed }) => [
              styles.primaryButton,
              reviewPending ? styles.primaryButtonDisabled : null,
              pressed ? styles.primaryButtonPressed : null,
            ]}
            disabled={reviewPending}
          >
            <Text style={styles.primaryButtonText}>
              {reviewPending ? 'Publishing review...' : 'Publish review'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Recent glow notes</Text>
        <Text style={styles.sectionTitle}>What customers shared</Text>

        {reviews.length === 0 ? (
          <View style={styles.emptySectionCard}>
            <Text style={styles.emptySectionTitle}>No reviews yet</Text>
            <Text style={styles.emptySectionBody}>
              Be the first guest to leave a note and a few photo references for this salon.
            </Text>
          </View>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <View style={styles.reviewAuthorRow}>
                    {review.customerAvatarUrl ? (
                      <Image
                        source={{ uri: review.customerAvatarUrl }}
                        style={styles.reviewAvatar}
                      />
                    ) : (
                      <View style={styles.reviewAvatarFallback}>
                        <Text style={styles.reviewAvatarFallbackText}>
                          {review.customerName.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.reviewAuthorMeta}>
                      <Text style={styles.reviewAuthorName}>{review.customerName}</Text>
                      <Text style={styles.reviewMetaText}>
                        {renderRatingStars(review.rating)} · {formatReviewDate(review.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>

                {review.comment ? (
                  <Text style={styles.reviewBody}>{review.comment}</Text>
                ) : null}

                {review.imageUrls.length > 0 ? (
                  <View style={styles.reviewImageGrid}>
                    {review.imageUrls.map((imageUrl) => (
                      <Image
                        key={`${review.id}-${imageUrl}`}
                        source={{ uri: imageUrl }}
                        style={styles.reviewImage}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {latestBooking ? (
        <View style={styles.successCard}>
          <Text style={styles.successLabel}>Booked</Text>
          <Text style={styles.successTitle}>Your appointment is set</Text>
          <Text style={styles.successBody}>
            {latestBooking.serviceName} on{' '}
            {new Date(latestBooking.startAt).toLocaleString()}
          </Text>
          {latestPayment ? (
            <Text style={styles.successMeta}>
              Paid {formatCurrency(latestPayment.total)} · Receipt{' '}
              {latestPayment.receiptNumber}
            </Text>
          ) : null}
          <View style={styles.successActionRow}>
            {latestPayment ? (
              <Pressable
                onPress={() => {
                  router.push({
                    pathname: '/payments',
                    params: { refresh: String(Date.now()) },
                  });
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed ? styles.primaryButtonPressed : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>View receipt</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                router.replace({
                  pathname: '/',
                  params: { refresh: String(Date.now()) },
                });
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Back to home</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 18,
    backgroundColor: '#ffeef5',
  },
  heroCard: {
    backgroundColor: '#fff9fc',
    borderRadius: 30,
    padding: 22,
    borderWidth: 2,
    borderColor: '#f7bfd1',
    gap: 10,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffd9e7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: '#c22767',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  favoriteButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f3c3d6',
  },
  favoriteButtonActive: {
    backgroundColor: '#ffdeeb',
    borderColor: '#ff6b9d',
  },
  favoriteButtonPressed: {
    opacity: 0.9,
  },
  favoriteButtonText: {
    color: '#7c1f48',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#2f1a33',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  heroMeta: {
    color: '#d6336c',
    fontSize: 13,
    fontWeight: '800',
  },
  heroAddress: {
    color: '#7b5c75',
    fontSize: 14,
    lineHeight: 21,
  },
  heroBody: {
    color: '#654f67',
    fontSize: 15,
    lineHeight: 22,
  },
  statusText: {
    color: '#915772',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#fff9fc',
    borderWidth: 1,
    borderColor: '#f4ccda',
  },
  loadingCopy: {
    flex: 1,
    gap: 4,
  },
  loadingTitle: {
    color: '#4d2340',
    fontSize: 16,
    fontWeight: '800',
  },
  loadingText: {
    color: '#6a566c',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: '#ff4f8c',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: '#341b36',
    fontSize: 24,
    fontWeight: '800',
  },
  chipWrap: {
    gap: 10,
  },
  serviceChip: {
    backgroundColor: '#fff9fc',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
    gap: 4,
  },
  serviceChipSelected: {
    backgroundColor: '#ffdeeb',
    borderColor: '#ff5e95',
  },
  serviceChipPressed: {
    opacity: 0.92,
  },
  serviceChipName: {
    color: '#311935',
    fontSize: 16,
    fontWeight: '800',
  },
  serviceChipNameSelected: {
    color: '#a61d55',
  },
  serviceChipMeta: {
    color: '#7d6278',
    fontSize: 13,
  },
  serviceChipMetaSelected: {
    color: '#a04c6f',
  },
  slotList: {
    gap: 10,
  },
  slotCard: {
    backgroundColor: '#fff9fc',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
    gap: 6,
  },
  slotCardSelected: {
    backgroundColor: '#fff0f6',
    borderColor: '#ff5e95',
  },
  slotCardDisabled: {
    opacity: 0.56,
  },
  slotCardPressed: {
    opacity: 0.92,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  slotTitle: {
    flex: 1,
    color: '#311935',
    fontSize: 15,
    fontWeight: '800',
  },
  slotBadge: {
    color: '#d6336c',
    fontSize: 12,
    fontWeight: '800',
  },
  slotMeta: {
    color: '#7d6278',
    fontSize: 13,
  },
  noteInput: {
    minHeight: 110,
    borderRadius: 24,
    backgroundColor: '#fff9fc',
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#341b36',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  checkoutCard: {
    gap: 8,
    backgroundColor: '#fff9fc',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
  },
  checkoutTitle: {
    color: '#311935',
    fontSize: 18,
    fontWeight: '800',
  },
  checkoutLine: {
    color: '#6d5870',
    fontSize: 14,
    lineHeight: 20,
  },
  reviewComposerCard: {
    gap: 12,
    backgroundColor: '#fff9fc',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
  },
  reviewComposerLabel: {
    color: '#311935',
    fontSize: 14,
    fontWeight: '800',
  },
  reviewRatingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewRatingChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
    backgroundColor: '#fffdfd',
  },
  reviewRatingChipSelected: {
    backgroundColor: '#ffe3ef',
    borderColor: '#ff5e95',
  },
  reviewRatingChipPressed: {
    opacity: 0.92,
  },
  reviewRatingChipText: {
    color: '#7d6278',
    fontSize: 14,
    fontWeight: '800',
  },
  reviewRatingChipTextSelected: {
    color: '#b2245d',
  },
  reviewInput: {
    borderRadius: 18,
    backgroundColor: '#fffdfd',
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#341b36',
    fontSize: 14,
  },
  reviewTextarea: {
    minHeight: 110,
    borderRadius: 22,
    backgroundColor: '#fffdfd',
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#341b36',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  reviewImagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  reviewAddImageButton: {
    borderRadius: 999,
    backgroundColor: '#341b36',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  reviewAddImageButtonPressed: {
    opacity: 0.92,
  },
  reviewAddImageButtonText: {
    color: '#fffafc',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewImageInputList: {
    gap: 10,
  },
  reviewImageInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  reviewImageUrlInput: {
    flex: 1,
  },
  reviewRemoveImageButton: {
    borderRadius: 16,
    backgroundColor: '#fff1f6',
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  reviewRemoveImageButtonPressed: {
    opacity: 0.9,
  },
  reviewRemoveImageButtonText: {
    color: '#9b4668',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewList: {
    gap: 12,
  },
  reviewCard: {
    gap: 12,
    backgroundColor: '#fff9fc',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
  },
  reviewCardHeader: {
    gap: 10,
  },
  reviewAuthorRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  reviewAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f6dbe6',
  },
  reviewAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f6dbe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarFallbackText: {
    color: '#98365e',
    fontSize: 20,
    fontWeight: '800',
  },
  reviewAuthorMeta: {
    flex: 1,
    gap: 2,
  },
  reviewAuthorName: {
    color: '#311935',
    fontSize: 16,
    fontWeight: '800',
  },
  reviewMetaText: {
    color: '#7d6278',
    fontSize: 13,
  },
  reviewBody: {
    color: '#5d4c60',
    fontSize: 14,
    lineHeight: 21,
  },
  reviewImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewImage: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: '#f6dbe6',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5e95',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: '#fffafc',
    fontSize: 14,
    fontWeight: '800',
  },
  successCard: {
    gap: 8,
    backgroundColor: '#fff6cc',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#f0d987',
  },
  successLabel: {
    color: '#8f641e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  successTitle: {
    color: '#3d2812',
    fontSize: 22,
    fontWeight: '800',
  },
  successBody: {
    color: '#6c4d2c',
    fontSize: 14,
    lineHeight: 20,
  },
  successMeta: {
    color: '#7a4661',
    fontSize: 12,
    fontWeight: '700',
  },
  successActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#341b36',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  secondaryButtonPressed: {
    opacity: 0.92,
  },
  secondaryButtonText: {
    color: '#fffafc',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    gap: 10,
    backgroundColor: '#fff9fc',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
  },
  emptyTitle: {
    color: '#341b36',
    fontSize: 24,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#6f5871',
    fontSize: 14,
    lineHeight: 20,
  },
  emptySectionCard: {
    gap: 6,
    backgroundColor: '#fff9fc',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#f4c2d5',
  },
  emptySectionTitle: {
    color: '#341b36',
    fontSize: 17,
    fontWeight: '800',
  },
  emptySectionBody: {
    color: '#6f5871',
    fontSize: 14,
    lineHeight: 20,
  },
});

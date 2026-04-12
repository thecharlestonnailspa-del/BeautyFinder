import { Link, Stack, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type {
  BookingRecord,
  BusinessSummary,
  NotificationRecord,
  PaymentRecord,
  SessionPayload,
} from '@beauty-finder/types';
import {
  businessMatchesSearch,
  clearStoredSession,
  fallbackBusinesses,
  fallbackPayments,
  fetchJson,
  formatBusinessAddress,
  formatDistanceKm,
  getAuthHeaders,
  getBusinessDistanceKm,
  getStoredSession,
  sortBusinessesForHomepage,
  type UserCoordinates,
} from '../src/lib/customer-experience';
import { BeautyMotion } from '../src/components/beauty-motion';
import {
  BeautyFinderWordmark,
  BusinessLogoPanel,
} from '../src/components/business-logo-panel';

type CategoryShortcut =
  | 'all'
  | 'nail'
  | 'hair'
  | 'top-rated'
  | 'nearby'
  | 'charleston'
  | 'brooklyn';

const heroMenu = [
  { id: 'all' as const, label: 'Beauty Home' },
  { id: 'nail' as const, label: 'Nail Salons' },
  { id: 'hair' as const, label: 'Hair Salons' },
  { id: 'top-rated' as const, label: 'Top Rated' },
  { id: 'nearby' as const, label: 'Near Me' },
  { id: 'charleston' as const, label: 'Charleston' },
  { id: 'brooklyn' as const, label: 'Brooklyn' },
];
const topNavItems = ['Nail', 'Hair', 'Nearby', 'Deals', 'Top Rated'];

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {body ? <Text style={styles.sectionBody}>{body}</Text> : null}
    </View>
  );
}

function TopNavButton({ label }: { label: string }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.topNavButton,
        pressed ? styles.topNavButtonPressed : null,
      ]}
    >
      <Text style={styles.topNavButtonText}>{label}</Text>
    </Pressable>
  );
}

function HeroShortcut({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.heroShortcut,
        active ? styles.heroShortcutActive : null,
        pressed ? styles.heroShortcutPressed : null,
      ]}
    >
      <Text
        style={[
          styles.heroShortcutText,
          active ? styles.heroShortcutTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HeroRail({
  businesses,
  activeIndex,
  onSelect,
  desktop,
}: {
  businesses: BusinessSummary[];
  activeIndex: number;
  onSelect: (index: number) => void;
  desktop: boolean;
}) {
  return (
    <View
      style={[
        styles.heroRail,
        desktop ? styles.heroRailDesktop : styles.heroRailMobile,
      ]}
    >
      {businesses.map((business, index) => (
        <Pressable
          key={business.id}
          onPress={() => onSelect(index)}
          style={({ pressed }) => [
            styles.heroRailButton,
            desktop
              ? styles.heroRailButtonDesktop
              : styles.heroRailButtonMobile,
            index === activeIndex ? styles.heroRailButtonActive : null,
            pressed ? styles.heroRailButtonPressed : null,
          ]}
        />
      ))}
    </View>
  );
}

function SnapshotCard({
  eyebrow,
  title,
  body,
  footer,
}: {
  eyebrow: string;
  title: string;
  body: string;
  footer: string;
}) {
  return (
    <View style={styles.snapshotCard}>
      <Text style={styles.snapshotEyebrow}>{eyebrow}</Text>
      <Text style={styles.snapshotTitle}>{title}</Text>
      <Text style={styles.snapshotBody}>{body}</Text>
      <Text style={styles.snapshotFooter}>{footer}</Text>
    </View>
  );
}

function ResultCard({
  business,
  distanceLabel,
  compact,
}: {
  business: BusinessSummary;
  distanceLabel?: string | null;
  compact: boolean;
}) {
  const topService =
    [...business.services].sort((left, right) => right.price - left.price)[0] ??
    business.services[0];

  return (
    <View
      style={[styles.resultCard, compact ? styles.resultCardCompact : null]}
    >
      <View style={styles.resultCardVisual}>
        <View style={styles.resultCardImageOverlay} />
        <View style={styles.resultCardRatingPill}>
          <Text style={styles.resultCardRatingText}>
            {business.rating.toFixed(1)} · {business.reviewCount} reviews
          </Text>
        </View>
        <BusinessLogoPanel
          business={business}
          size="card"
          style={styles.resultCardIdentityPanel}
        />
      </View>

      <View style={styles.resultCardBody}>
        <View style={styles.resultCardHeader}>
          <View style={styles.resultCardHeaderCopy}>
            <Text style={styles.resultCardName}>{business.name}</Text>
            <Text style={styles.resultCardMeta}>
              {business.city}, {business.state}
              {distanceLabel ? ` · ${distanceLabel}` : ''}
            </Text>
          </View>
          <View style={styles.resultCardCategoryPill}>
            <Text style={styles.resultCardCategoryText}>
              {business.category}
            </Text>
          </View>
        </View>

        <Text style={styles.resultCardDescription} numberOfLines={3}>
          {business.description}
        </Text>
        <Text style={styles.resultCardServiceText}>
          Signature service · {topService.name} · ${topService.price}
        </Text>
        <Text style={styles.resultCardAddress} numberOfLines={2}>
          {formatBusinessAddress(business)}
        </Text>

        <Link
          href={{
            pathname: '/salons/[businessId]',
            params: { businessId: business.id },
          }}
          asChild
        >
          <Pressable
            style={({ pressed }) => [
              styles.resultCardButton,
              pressed ? styles.resultCardButtonPressed : null,
            ]}
          >
            <Text style={styles.resultCardButtonText}>
              View details and book
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function matchLocationQuery(business: BusinessSummary, locationQuery: string) {
  const query = locationQuery.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [
    business.addressLine1,
    business.addressLine2,
    business.city,
    business.state,
    business.postalCode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function getHeroHeadline(business: BusinessSummary) {
  if (business.category === 'nail') {
    return 'Find a glossy set worth leaving the house for.';
  }

  return 'Book a blowout, silk press, or trim without the scroll spiral.';
}

function getHeroLabel(business: BusinessSummary) {
  return business.category === 'nail'
    ? 'Nails near your plan'
    : 'Hair appointments that convert';
}

function getHeroCtaLabel(business: BusinessSummary) {
  const topService =
    [...business.services].sort((left, right) => right.price - left.price)[0] ??
    business.services[0];

  return topService ? `Book ${topService.name}` : 'Open salon';
}

function formatCoordinate(value: number) {
  return value.toFixed(4);
}

function formatCurrency(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function ActivityActionCard({
  eyebrow,
  title,
  body,
  cta,
  href,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.activityActionCard,
          pressed ? styles.activityActionCardPressed : null,
        ]}
      >
        <Text style={styles.activityActionEyebrow}>{eyebrow}</Text>
        <Text style={styles.activityActionTitle}>{title}</Text>
        <Text style={styles.activityActionBody}>{body}</Text>
        <View style={styles.activityActionFooter}>
          <Text style={styles.activityActionCta}>{cta}</Text>
          <Text style={styles.activityActionMeta}>Phase 5</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const { width } = useWindowDimensions();
  const [activeSession, setActiveSession] = useState<SessionPayload | null>(
    () => getStoredSession(),
  );
  const [businesses, setBusinesses] =
    useState<BusinessSummary[]>(fallbackBusinesses);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [userCoordinates, setUserCoordinates] =
    useState<UserCoordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    'Search a service or city, then turn on location to pull nearby salons to the top.',
  );
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState(
    'Loading today’s beauty highlights...',
  );
  const [activeShortcut, setActiveShortcut] = useState<CategoryShortcut>('all');
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const isDesktop = width >= 1080;
  const isTablet = width >= 720;

  useEffect(() => {
    setActiveSession(getStoredSession());
  }, [refresh]);

  useEffect(() => {
    let active = true;

    async function loadMarketplace() {
      try {
        const [nextBusinesses, nextBookings, nextNotifications, nextPayments] =
          await Promise.all([
            fetchJson<BusinessSummary[]>('/businesses'),
            activeSession
              ? fetchJson<BookingRecord[]>('/bookings', {
                  headers: getAuthHeaders(),
                })
              : Promise.resolve([] as BookingRecord[]),
            activeSession
              ? fetchJson<NotificationRecord[]>('/notifications', {
                  headers: getAuthHeaders(),
                })
              : Promise.resolve([] as NotificationRecord[]),
            activeSession
              ? fetchJson<PaymentRecord[]>('/payments', {
                  headers: getAuthHeaders(),
                })
              : Promise.resolve([] as PaymentRecord[]),
          ]);

        if (!active) {
          return;
        }

        setBusinesses(nextBusinesses ?? fallbackBusinesses);
        setBookings(nextBookings ?? []);
        setNotifications(nextNotifications ?? []);
        setPayments(nextPayments ?? (activeSession ? fallbackPayments : []));
        setStatusText('Live salon highlights are ready.');
      } catch {
        if (!active) {
          return;
        }

        setBusinesses(fallbackBusinesses);
        setBookings([]);
        setNotifications([]);
        setPayments(activeSession ? fallbackPayments : []);
        setStatusText('Using offline showcase data.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMarketplace();

    return () => {
      active = false;
    };
  }, [activeSession, refresh]);

  const homepageBusinesses = useMemo(
    () => sortBusinessesForHomepage(businesses),
    [businesses],
  );

  const heroBusinesses = useMemo(
    () => homepageBusinesses.slice(0, 4),
    [homepageBusinesses],
  );

  useEffect(() => {
    if (activeHeroIndex >= heroBusinesses.length) {
      setActiveHeroIndex(0);
    }
  }, [activeHeroIndex, heroBusinesses.length]);

  const activeHero =
    heroBusinesses[activeHeroIndex] ??
    homepageBusinesses[0] ??
    fallbackBusinesses[0];

  const visibleBusinesses = useMemo(() => {
    const filtered = homepageBusinesses
      .filter((business) => businessMatchesSearch(business, searchText))
      .filter((business) => matchLocationQuery(business, locationQuery))
      .filter((business) => {
        switch (activeShortcut) {
          case 'nail':
          case 'hair':
            return business.category === activeShortcut;
          case 'charleston':
            return business.city.toLowerCase() === 'charleston';
          case 'brooklyn':
            return business.city.toLowerCase() === 'brooklyn';
          case 'top-rated':
            return business.rating >= 4.8;
          case 'nearby':
            return true;
          case 'all':
          default:
            return true;
        }
      })
      .map((business) => ({
        business,
        distanceKm: userCoordinates
          ? getBusinessDistanceKm(business, userCoordinates)
          : null,
      }));

    if (activeShortcut === 'nearby' && userCoordinates) {
      return filtered.sort((left, right) => {
        if (left.distanceKm == null) {
          return 1;
        }

        if (right.distanceKm == null) {
          return -1;
        }

        return left.distanceKm - right.distanceKm;
      });
    }

    if (activeShortcut === 'top-rated') {
      return filtered.sort((left, right) => {
        if (left.business.rating !== right.business.rating) {
          return right.business.rating - left.business.rating;
        }

        return right.business.reviewCount - left.business.reviewCount;
      });
    }

    return filtered;
  }, [
    activeShortcut,
    homepageBusinesses,
    locationQuery,
    searchText,
    userCoordinates,
  ]);

  const nearbySpotlights = useMemo(() => {
    if (!userCoordinates) {
      return [];
    }

    return homepageBusinesses
      .map((business) => ({
        business,
        distanceKm: getBusinessDistanceKm(business, userCoordinates),
      }))
      .filter(
        (entry): entry is { business: BusinessSummary; distanceKm: number } =>
          entry.distanceKm != null && entry.distanceKm <= 60,
      )
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, 3);
  }, [homepageBusinesses, userCoordinates]);

  const closestBusiness = nearbySpotlights[0] ?? null;
  const primaryBooking = activeSession ? (bookings[0] ?? null) : null;
  const primaryNotification = activeSession ? (notifications[0] ?? null) : null;
  const primaryPayment = activeSession ? (payments[0] ?? null) : null;

  async function getWebCoordinates() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new Error('Browser geolocation is not available.');
    }

    return await new Promise<UserCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    });
  }

  async function findNearbyBusinesses() {
    setLocationLoading(true);

    try {
      let coordinates: UserCoordinates;

      if (Platform.OS === 'web') {
        coordinates = await getWebCoordinates();
      } else {
        const existingPermission =
          await Location.getForegroundPermissionsAsync();
        const permission =
          existingPermission.status === 'granted'
            ? existingPermission
            : await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          setUserCoordinates(null);
          setLocationMessage(
            'Location access was denied. Turn on Location for Beauty Finder, then try again.',
          );
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      }

      setUserCoordinates(coordinates);
      setActiveShortcut('nearby');
      setLocationMessage(
        `Nearby mode is on at ${formatCoordinate(coordinates.latitude)}, ${formatCoordinate(coordinates.longitude)}.`,
      );
    } catch {
      setUserCoordinates(null);
      setLocationMessage(
        Platform.OS === 'web'
          ? 'Browser location is blocked or unavailable. Allow Location from the browser controls and try again.'
          : 'Could not read your current location right now.',
      );
    } finally {
      setLocationLoading(false);
    }
  }

  function applySearch() {
    if (visibleBusinesses.length === 0) {
      setStatusText(
        'No salons match that search yet. Try a wider area or another service.',
      );
      return;
    }

    setStatusText(
      `${visibleBusinesses.length} beauty spots are ready to explore.`,
    );
  }

  function handleSignOut() {
    clearStoredSession();
    setActiveSession(null);
    setBookings([]);
    setNotifications([]);
    setPayments([]);
    setStatusText(
      'Signed out. You can still browse, then log in again when you want to book.',
    );
  }

  function selectShortcut(shortcut: CategoryShortcut) {
    setActiveShortcut(shortcut);

    if (shortcut === 'charleston') {
      setLocationQuery('Charleston, SC');
      setStatusText('Showing Charleston beauty spots first.');
      return;
    }

    if (shortcut === 'brooklyn') {
      setLocationQuery('Brooklyn, NY');
      setStatusText('Showing Brooklyn beauty spots first.');
      return;
    }

    if (shortcut === 'nearby' && !userCoordinates) {
      void findNearbyBusinesses();
      return;
    }

    if (shortcut === 'all') {
      setLocationQuery('');
      setStatusText('Back to the full Beauty Finder home menu.');
      return;
    }

    setStatusText(`Filtered by ${shortcut.replace('-', ' ')}.`);
  }

  const heroPrimaryService =
    [...activeHero.services].sort(
      (left, right) => right.price - left.price,
    )[0] ?? activeHero.services[0];

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Beauty Finder', headerShown: false }} />

      <View style={styles.heroShell}>
        <View
          style={[
            styles.heroStage,
            { minHeight: isDesktop ? 720 : isTablet ? 620 : 560 },
          ]}
        >
          <View style={styles.heroBackdropOrbPrimary} />
          <View style={styles.heroBackdropOrbSecondary} />
          <View style={styles.heroBackdropGrid} />

          <View style={styles.heroInner}>
            <View style={styles.topBar}>
              <View style={styles.brandRow}>
                <BeautyFinderWordmark tone="dark" compact={!isTablet} />
              </View>

              {isDesktop ? (
                <View style={styles.topNavRow}>
                  {topNavItems.map((item) => (
                    <TopNavButton key={item} label={item} />
                  ))}
                </View>
              ) : null}

              <View style={styles.authRow}>
                {activeSession ? (
                  <>
                    <View style={styles.sessionBadge}>
                      <Text style={styles.sessionBadgeText}>
                        {activeSession.user.name}
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleSignOut}
                      style={({ pressed }) => [
                        styles.ghostButton,
                        pressed ? styles.ghostButtonPressed : null,
                      ]}
                    >
                      <Text style={styles.ghostButtonText}>Sign Out</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Link
                      href={{ pathname: '/auth', params: { mode: 'login' } }}
                      asChild
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.ghostButton,
                          pressed ? styles.ghostButtonPressed : null,
                        ]}
                      >
                        <Text style={styles.ghostButtonText}>Log In</Text>
                      </Pressable>
                    </Link>
                    <Link
                      href={{ pathname: '/auth', params: { mode: 'signup' } }}
                      asChild
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.primaryChromeButton,
                          pressed ? styles.primaryChromeButtonPressed : null,
                        ]}
                      >
                        <Text style={styles.primaryChromeButtonText}>
                          Sign Up
                        </Text>
                      </Pressable>
                    </Link>
                  </>
                )}
              </View>
            </View>

            <View
              style={[
                styles.searchBar,
                isDesktop ? styles.searchBarDesktop : styles.searchBarMobile,
              ]}
            >
              <View style={styles.searchInputWrap}>
                <Text style={styles.searchLabel}>Find</Text>
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  onSubmitEditing={applySearch}
                  placeholder="nail salons, silk press, gel manicure"
                  placeholderTextColor="#787878"
                  style={styles.searchInput}
                />
              </View>

              <View
                style={[
                  styles.searchDivider,
                  isDesktop
                    ? styles.searchDividerDesktop
                    : styles.searchDividerMobile,
                ]}
              />

              <View style={styles.searchInputWrap}>
                <Text style={styles.searchLabel}>Near</Text>
                <TextInput
                  value={locationQuery}
                  onChangeText={setLocationQuery}
                  onSubmitEditing={applySearch}
                  placeholder="Charleston, SC 29407"
                  placeholderTextColor="#787878"
                  style={styles.searchInput}
                />
              </View>

              <Pressable
                onPress={applySearch}
                style={({ pressed }) => [
                  styles.searchButton,
                  pressed ? styles.searchButtonPressed : null,
                ]}
              >
                <Text style={styles.searchButtonText}>Search</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.heroShortcutRow}
            >
              {heroMenu.map((item) => (
                <HeroShortcut
                  key={item.id}
                  label={item.label}
                  active={activeShortcut === item.id}
                  onPress={() => selectShortcut(item.id)}
                />
              ))}
            </ScrollView>

            <View
              style={[
                styles.heroContent,
                isDesktop
                  ? styles.heroContentDesktop
                  : styles.heroContentMobile,
              ]}
            >
              {isDesktop ? (
                <HeroRail
                  businesses={heroBusinesses}
                  activeIndex={activeHeroIndex}
                  onSelect={setActiveHeroIndex}
                  desktop
                />
              ) : null}

              <View style={styles.heroCopyBlock}>
                <View
                  style={[
                    styles.heroWelcomeBanner,
                    isTablet
                      ? styles.heroWelcomeBannerDesktop
                      : styles.heroWelcomeBannerMobile,
                  ]}
                >
                  <BeautyMotion
                    variant="banner"
                    size={isDesktop ? 138 : isTablet ? 120 : 104}
                  />
                  <View style={styles.heroWelcomeCopy}>
                    <Text style={styles.heroWelcomeEyebrow}>
                      Beauty Finder Select
                    </Text>
                    <Text style={styles.heroWelcomeTitle}>
                      Verified salons. Cleaner identity. Faster booking.
                    </Text>
                    <Text style={styles.heroWelcomeBody}>
                      {loading
                        ? 'We are lining up today’s featured salons and nearby beauty highlights.'
                        : 'Search and booking stay live, while the storefront now leads with sharper logo-driven branding.'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.heroEyebrow}>
                  {getHeroLabel(activeHero)}
                </Text>
                <Text
                  style={[
                    styles.heroHeadline,
                    isDesktop
                      ? null
                      : isTablet
                        ? styles.heroHeadlineTablet
                        : styles.heroHeadlineMobile,
                  ]}
                >
                  {getHeroHeadline(activeHero)}
                </Text>
                <Text style={styles.heroDescription}>
                  {activeHero.description}
                </Text>

                <View style={styles.heroActionRow}>
                  <Link
                    href={{
                      pathname: '/salons/[businessId]',
                      params: { businessId: activeHero.id },
                    }}
                    asChild
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.heroPrimaryAction,
                        pressed ? styles.heroPrimaryActionPressed : null,
                      ]}
                    >
                      <Text style={styles.heroPrimaryActionText}>
                        {getHeroCtaLabel(activeHero)}
                      </Text>
                    </Pressable>
                  </Link>

                  <Pressable
                    onPress={findNearbyBusinesses}
                    style={({ pressed }) => [
                      styles.heroSecondaryAction,
                      pressed ? styles.heroSecondaryActionPressed : null,
                    ]}
                  >
                    <Text style={styles.heroSecondaryActionText}>
                      {locationLoading ? 'Finding you...' : 'Use my location'}
                    </Text>
                  </Pressable>
                </View>

                {!isDesktop ? (
                  <HeroRail
                    businesses={heroBusinesses}
                    activeIndex={activeHeroIndex}
                    onSelect={setActiveHeroIndex}
                    desktop={false}
                  />
                ) : null}
              </View>

              <View style={styles.heroInfoCard}>
                <Text style={styles.heroInfoEyebrow}>Featured now</Text>
                <BusinessLogoPanel
                  business={activeHero}
                  size="hero"
                  tone="dark"
                />
                <Text style={styles.heroInfoService}>
                  Premium pick · {heroPrimaryService?.name ?? 'Book now'} · $
                  {heroPrimaryService?.price ?? 0}
                </Text>
                <View style={styles.heroInfoStatusRow}>
                  {loading ? (
                    <BeautyMotion variant="loading" size={46} />
                  ) : null}
                  <Text style={styles.heroInfoStatus}>
                    {loading ? 'Loading...' : statusText}
                  </Text>
                </View>
                {closestBusiness?.distanceKm != null ? (
                  <Text style={styles.heroInfoDistance}>
                    Closest salon right now: {closestBusiness.business.name} ·{' '}
                    {formatDistanceKm(closestBusiness.distanceKm)}
                  </Text>
                ) : (
                  <Text style={styles.heroInfoDistance}>{locationMessage}</Text>
                )}
              </View>
            </View>

            <View style={styles.heroFooter}>
              <View>
                <Text style={styles.heroFooterTitle}>{activeHero.name}</Text>
                <Text style={styles.heroFooterSubtitle}>
                  Verified salon profile
                </Text>
              </View>
              <Text style={styles.heroFooterCaption}>
                {heroPrimaryService
                  ? `${heroPrimaryService.name} starts at $${heroPrimaryService.price}`
                  : 'Open the salon'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.contentSurface}>
        <SectionHeader
          eyebrow="Recent Activity"
          title="Your beauty home now opens with a cleaner brand system"
          body="Search first, browse category shortcuts, and keep recent bookings and updates in the same polished landing flow."
        />

        <View
          style={[
            styles.snapshotGrid,
            isDesktop ? styles.snapshotGridDesktop : styles.snapshotGridMobile,
          ]}
        >
          <SnapshotCard
            eyebrow="Next Booking"
            title={
              primaryBooking
                ? primaryBooking.serviceName
                : 'Log in to sync your bookings'
            }
            body={
              primaryBooking
                ? new Date(primaryBooking.startAt).toLocaleString()
                : 'Your saved appointments appear here after you sign in.'
            }
            footer={
              primaryBooking
                ? `Status · ${primaryBooking.status}`
                : 'Browse first, then book with your own account.'
            }
          />
          <SnapshotCard
            eyebrow="Latest Receipt"
            title={
              primaryPayment
                ? formatCurrency(primaryPayment.total, primaryPayment.currency)
                : 'No payment yet'
            }
            body={
              primaryPayment
                ? `Receipt ${primaryPayment.receiptNumber}`
                : 'Book and pay from the salon screen to create your first receipt.'
            }
            footer={
              primaryPayment
                ? `${(primaryPayment.cardBrand ?? 'CARD').toUpperCase()} ending in ${primaryPayment.cardLast4 ?? '----'}`
                : 'Phase 5 now includes a real payment history screen.'
            }
          />
          <SnapshotCard
            eyebrow="Inbox"
            title={
              primaryNotification
                ? primaryNotification.title
                : 'No account inbox yet'
            }
            body={
              primaryNotification
                ? primaryNotification.body
                : 'Business updates and booking changes show here after sign in.'
            }
            footer={
              primaryNotification
                ? new Date(primaryNotification.createdAt).toLocaleString()
                : 'You can still explore salons without logging in.'
            }
          />
          <SnapshotCard
            eyebrow="Location"
            title={userCoordinates ? 'Nearby mode is on' : 'Nearby mode is off'}
            body={
              userCoordinates
                ? `${formatCoordinate(userCoordinates.latitude)}, ${formatCoordinate(userCoordinates.longitude)}`
                : 'Turn on location to sort the closest salons first.'
            }
            footer={
              closestBusiness?.distanceKm != null
                ? `${closestBusiness.business.name} · ${formatDistanceKm(closestBusiness.distanceKm)}`
                : 'You can still browse by service or city.'
            }
          />
        </View>

        <View
          style={[
            styles.activityActionGrid,
            isDesktop
              ? styles.activityActionGridDesktop
              : styles.activityActionGridMobile,
          ]}
        >
          <ActivityActionCard
            eyebrow="Payments"
            title={
              primaryPayment
                ? `Receipt ${primaryPayment.receiptNumber}`
                : 'Open payment history'
            }
            body={
              primaryPayment
                ? `See line items, totals, and the last charged card for ${formatCurrency(primaryPayment.total, primaryPayment.currency)}.`
                : 'Phase 5 now has a dedicated receipts screen for completed bookings.'
            }
            cta="Open payments"
            href="/payments"
          />
          <ActivityActionCard
            eyebrow="Notifications"
            title={
              activeSession
                ? `${notifications.filter((item) => !item.read).length} unread updates`
                : 'Manage alert settings'
            }
            body={
              activeSession
                ? 'Open the inbox, mark items as read, and tune booking, message, and receipt alerts.'
                : 'Log in, then open the new notifications screen to manage preferences.'
            }
            cta="Open notifications"
            href="/notifications"
          />
        </View>

        {nearbySpotlights.length > 0 ? (
          <>
            <SectionHeader
              eyebrow="Nearby"
              title="Beauty spots around your current location"
              body="These salons rise to the top when location is available."
            />
            <View
              style={[
                styles.resultGrid,
                isDesktop ? styles.resultGridDesktop : styles.resultGridMobile,
              ]}
            >
              {nearbySpotlights.map(({ business, distanceKm }) => (
                <ResultCard
                  key={`nearby-${business.id}`}
                  business={business}
                  distanceLabel={formatDistanceKm(distanceKm)}
                  compact={isDesktop}
                />
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader
          eyebrow={activeShortcut === 'all' ? 'Featured' : 'Filtered'}
          title={
            locationQuery
              ? `Beauty spots around ${locationQuery}`
              : 'Featured salons to open next'
          }
          body="The hero now leads with logo-first branding, while the listings below stay connected to live search, distance, and booking data."
        />

        {visibleBusinesses.length > 0 ? (
          <View
            style={[
              styles.resultGrid,
              isDesktop ? styles.resultGridDesktop : styles.resultGridMobile,
            ]}
          >
            {visibleBusinesses.map(({ business, distanceKm }) => (
              <ResultCard
                key={business.id}
                business={business}
                distanceLabel={
                  distanceKm != null ? formatDistanceKm(distanceKm) : null
                }
                compact={isDesktop}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>
              No salons match that combination yet
            </Text>
            <Text style={styles.emptyStateBody}>
              Try a broader service keyword, clear the city field, or switch
              back to the full home menu.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f4f1ec',
  },
  heroShell: {
    backgroundColor: '#0f1113',
  },
  heroStage: {
    justifyContent: 'space-between',
    overflow: 'hidden',
    backgroundColor: '#111317',
  },
  heroBackdropOrbPrimary: {
    position: 'absolute',
    top: -96,
    right: -48,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(183, 138, 76, 0.18)',
  },
  heroBackdropOrbSecondary: {
    position: 'absolute',
    bottom: -110,
    left: -54,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: 'rgba(126, 66, 92, 0.18)',
  },
  heroBackdropGrid: {
    position: 'absolute',
    top: 18,
    right: 18,
    bottom: 18,
    left: 18,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  heroInner: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    gap: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogo: {
    width: 220,
    height: 76,
  },
  brandLogoMobile: {
    width: 174,
    height: 60,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  topNavButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  topNavButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  topNavButtonText: {
    color: '#f2f2f2',
    fontSize: 14,
    fontWeight: '700',
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionBadge: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sessionBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  ghostButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ghostButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  ghostButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryChromeButton: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: '#e12727',
  },
  primaryChromeButtonPressed: {
    backgroundColor: '#bf1e1e',
  },
  primaryChromeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  searchBar: {
    borderRadius: 28,
    backgroundColor: '#ffffff',
    padding: 10,
    alignItems: 'stretch',
    gap: 10,
  },
  searchBarDesktop: {
    flexDirection: 'row',
  },
  searchBarMobile: {
    flexDirection: 'column',
  },
  searchInputWrap: {
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchLabel: {
    color: '#6a6a6a',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  searchInput: {
    color: '#202020',
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 4,
  },
  searchDivider: {
    backgroundColor: '#ebebeb',
  },
  searchDividerDesktop: {
    width: 1,
    marginVertical: 10,
  },
  searchDividerMobile: {
    height: 1,
    marginHorizontal: 10,
  },
  searchButton: {
    minWidth: 118,
    borderRadius: 20,
    backgroundColor: '#e12727',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  searchButtonPressed: {
    backgroundColor: '#bf1e1e',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  heroShortcutRow: {
    gap: 10,
    paddingRight: 24,
  },
  heroShortcut: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  heroShortcutActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  heroShortcutPressed: {
    opacity: 0.9,
  },
  heroShortcutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  heroShortcutTextActive: {
    color: '#141414',
  },
  heroContent: {
    flex: 1,
    gap: 18,
    alignItems: 'stretch',
  },
  heroContentDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroContentMobile: {
    flexDirection: 'column',
  },
  heroRail: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  heroRailDesktop: {
    width: 42,
    paddingRight: 6,
  },
  heroRailMobile: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  heroRailButton: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  heroRailButtonDesktop: {
    width: 10,
    height: 64,
  },
  heroRailButtonMobile: {
    width: 52,
    height: 8,
  },
  heroRailButtonActive: {
    backgroundColor: '#ffffff',
  },
  heroRailButtonPressed: {
    opacity: 0.85,
  },
  heroCopyBlock: {
    flex: 1.2,
    gap: 16,
    justifyContent: 'center',
  },
  heroWelcomeBanner: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(7,7,7,0.26)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    alignItems: 'center',
  },
  heroWelcomeBannerDesktop: {
    flexDirection: 'row',
  },
  heroWelcomeBannerMobile: {
    flexDirection: 'column',
  },
  heroWelcomeCopy: {
    flex: 1,
    gap: 5,
  },
  heroWelcomeMascot: {
    alignSelf: 'center',
  },
  heroWelcomeEyebrow: {
    color: '#f7d288',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroWelcomeTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '800',
  },
  heroWelcomeBody: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    lineHeight: 21,
  },
  heroEyebrow: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroHeadline: {
    color: '#ffffff',
    fontSize: 56,
    lineHeight: 58,
    fontWeight: '800',
    maxWidth: 680,
  },
  heroHeadlineTablet: {
    fontSize: 46,
    lineHeight: 48,
  },
  heroHeadlineMobile: {
    fontSize: 35,
    lineHeight: 38,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 620,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroPrimaryAction: {
    borderRadius: 999,
    backgroundColor: '#e12727',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  heroPrimaryActionPressed: {
    backgroundColor: '#bf1e1e',
  },
  heroPrimaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  heroSecondaryAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroSecondaryActionPressed: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroSecondaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  heroInfoCard: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'stretch',
    borderRadius: 28,
    padding: 20,
    backgroundColor: 'rgba(16,16,16,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 10,
  },
  heroInfoEyebrow: {
    color: '#cfcfcf',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroInfoTitle: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
  },
  heroInfoMeta: {
    color: '#d9d9d9',
    fontSize: 15,
  },
  heroInfoService: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  heroInfoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroInfoStatus: {
    flex: 1,
    color: '#ffdddd',
    fontSize: 14,
    lineHeight: 20,
  },
  heroInfoDistance: {
    color: '#f1f1f1',
    fontSize: 14,
    lineHeight: 20,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  heroFooterTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  heroFooterSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  heroFooterCaption: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  contentSurface: {
    backgroundColor: '#faf8f5',
    marginTop: -18,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 34,
    gap: 22,
  },
  sectionHeader: {
    gap: 8,
  },
  sectionEyebrow: {
    color: '#c1272d',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: '#1f1f1f',
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '800',
    maxWidth: 780,
  },
  sectionBody: {
    color: '#5f5f5f',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 860,
  },
  snapshotGrid: {
    gap: 14,
  },
  snapshotGridDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  snapshotGridMobile: {
    flexDirection: 'column',
  },
  activityActionGrid: {
    gap: 16,
    marginTop: 4,
  },
  activityActionGridDesktop: {
    flexDirection: 'row',
  },
  activityActionGridMobile: {
    flexDirection: 'column',
  },
  activityActionCard: {
    flex: 1,
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#fff6fa',
    borderWidth: 1,
    borderColor: '#f3c9da',
    gap: 8,
  },
  activityActionCardPressed: {
    opacity: 0.92,
  },
  activityActionEyebrow: {
    color: '#b14d78',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  activityActionTitle: {
    color: '#561a36',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  activityActionBody: {
    color: '#7a4a60',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 44,
  },
  activityActionFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityActionCta: {
    color: '#c22767',
    fontSize: 14,
    fontWeight: '800',
  },
  activityActionMeta: {
    color: '#8f6a79',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  snapshotCard: {
    flex: 1,
    minWidth: 230,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ece7e2',
    padding: 18,
    gap: 8,
  },
  snapshotEyebrow: {
    color: '#a13e45',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  snapshotTitle: {
    color: '#1f1f1f',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  snapshotBody: {
    color: '#535353',
    fontSize: 15,
    lineHeight: 22,
  },
  snapshotFooter: {
    color: '#8a8a8a',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  resultGrid: {
    gap: 16,
  },
  resultGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  resultGridMobile: {
    flexDirection: 'column',
  },
  resultCard: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ece7e2',
  },
  resultCardCompact: {
    width: '48.8%',
  },
  resultCardVisual: {
    minHeight: 230,
    padding: 16,
    backgroundColor: '#111317',
    justifyContent: 'space-between',
    gap: 16,
  },
  resultCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  resultCardIdentityPanel: {
    marginTop: 'auto',
  },
  resultCardRatingPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultCardRatingText: {
    color: '#252525',
    fontSize: 12,
    fontWeight: '800',
  },
  resultCardBody: {
    padding: 18,
    gap: 10,
  },
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  resultCardHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  resultCardName: {
    color: '#181818',
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '800',
  },
  resultCardMeta: {
    color: '#6a6a6a',
    fontSize: 14,
    lineHeight: 20,
  },
  resultCardCategoryPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f5f0ea',
  },
  resultCardCategoryText: {
    color: '#4d4d4d',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  resultCardDescription: {
    color: '#545454',
    fontSize: 15,
    lineHeight: 22,
  },
  resultCardServiceText: {
    color: '#c1272d',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  resultCardAddress: {
    color: '#838383',
    fontSize: 13,
    lineHeight: 19,
  },
  resultCardButton: {
    borderRadius: 999,
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 4,
  },
  resultCardButtonPressed: {
    backgroundColor: '#2a2a2a',
  },
  resultCardButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyStateCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ece7e2',
    padding: 22,
    gap: 8,
  },
  emptyStateTitle: {
    color: '#1d1d1d',
    fontSize: 24,
    fontWeight: '800',
  },
  emptyStateBody: {
    color: '#616161',
    fontSize: 15,
    lineHeight: 22,
  },
});

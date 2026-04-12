import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  BookingRecord,
  BusinessSummary,
  PaymentRecord,
  SessionPayload,
} from '@beauty-finder/types';
import {
  fallbackBookings,
  fallbackBusinesses,
  fallbackPayments,
  fetchJson,
  getAuthHeaders,
  isCustomerDemoModeEnabled,
  getStoredSession,
} from '../src/lib/customer-experience';

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

function formatPaymentMethod(payment: PaymentRecord) {
  if (payment.method === 'cash') {
    return 'Cash collected at the salon';
  }

  const brand = payment.cardBrand?.toUpperCase() ?? 'CARD';
  return `${brand} ending in ${payment.cardLast4 ?? '----'}`;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function LineItem({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.lineItemRow}>
      <Text
        style={[styles.lineItemLabel, strong ? styles.lineItemStrong : null]}
      >
        {label}
      </Text>
      <Text
        style={[styles.lineItemValue, strong ? styles.lineItemStrong : null]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function PaymentsScreen() {
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const demoModeEnabled = isCustomerDemoModeEnabled();
  const [session, setSession] = useState<SessionPayload | null>(() =>
    getStoredSession(),
  );
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [businesses, setBusinesses] =
    useState<BusinessSummary[]>(fallbackBusinesses);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState(
    'Loading your Beauty Finder receipts...',
  );

  useEffect(() => {
    setSession(getStoredSession());
  }, [refresh]);

  useEffect(() => {
    let active = true;

    async function loadPayments() {
      if (!session) {
        if (!active) {
          return;
        }

        setPayments([]);
        setBookings([]);
        setBusinesses(fallbackBusinesses);
        setLoading(false);
        setStatusText('Log in to unlock your payment history and receipts.');
        return;
      }

      setLoading(true);
      setStatusText('Syncing your live receipts...');

      try {
        const [nextPayments, nextBookings, nextBusinesses] = await Promise.all([
          fetchJson<PaymentRecord[]>('/payments', {
            headers: getAuthHeaders(),
          }),
          fetchJson<BookingRecord[]>('/bookings', {
            headers: getAuthHeaders(),
          }),
          fetchJson<BusinessSummary[]>('/businesses'),
        ]);

        if (!active) {
          return;
        }

        const resolvedPayments = nextPayments ?? fallbackPayments;
        setPayments(resolvedPayments);
        setBookings(nextBookings ?? fallbackBookings);
        setBusinesses(nextBusinesses ?? fallbackBusinesses);
        setStatusText(
          resolvedPayments.length > 0
            ? 'Live receipts are ready.'
            : 'No payments yet. Book a salon to generate your first receipt.',
        );
      } catch {
        if (!active) {
          return;
        }

        setPayments(fallbackPayments);
        setBookings(fallbackBookings);
        setBusinesses(fallbackBusinesses);
        setStatusText('Using showcase receipt data while the API catches up.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPayments();

    return () => {
      active = false;
    };
  }, [session, refresh]);

  const bookingsById = useMemo(
    () => new Map(bookings.map((booking) => [booking.id, booking])),
    [bookings],
  );
  const businessesById = useMemo(
    () => new Map(businesses.map((business) => [business.id, business])),
    [businesses],
  );
  const totalSpent = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.total, 0),
    [payments],
  );
  const totalSaved = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.discount, 0),
    [payments],
  );
  const latestPayment = payments[0] ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Payments' }} />

      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Phase 5</Text>
        <Text style={styles.heroTitle}>Payments and receipts</Text>
        <Text style={styles.heroBody}>{statusText}</Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#c22767" />
            <Text style={styles.loadingText}>
              Pulling current payment history...
            </Text>
          </View>
        ) : null}

        <View style={styles.metricGrid}>
          <SummaryMetric
            label="Total paid"
            value={formatCurrency(totalSpent || 0)}
          />
          <SummaryMetric label="Receipts" value={String(payments.length)} />
          <SummaryMetric
            label="Saved"
            value={formatCurrency(totalSaved || 0)}
          />
        </View>

        <View style={styles.heroActionRow}>
          <Link href="/notifications" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Open notifications</Text>
            </Pressable>
          </Link>
          <Link href="/salons/biz-1" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Book another salon</Text>
            </Pressable>
          </Link>
        </View>

        {latestPayment ? (
          <View style={styles.receiptBanner}>
            <Text style={styles.receiptBannerLabel}>Latest receipt</Text>
            <Text style={styles.receiptBannerValue}>
              {latestPayment.receiptNumber}
            </Text>
          </View>
        ) : null}
      </View>

      {!session ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Customer login required</Text>
          <Text style={styles.emptyBody}>
            {demoModeEnabled
              ? 'Use the local seeded customer account to see payment history and receipt details.'
              : 'Sign in with your customer account to see payment history and receipt details.'}
          </Text>
          <Link href="/auth?mode=login" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Log in now</Text>
            </Pressable>
          </Link>
        </View>
      ) : payments.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No receipts yet</Text>
          <Text style={styles.emptyBody}>
            Book a service from a salon detail page, then come back here to see
            the completed checkout summary.
          </Text>
          <Link href="/salons/biz-1" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Start booking</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <View style={styles.receiptList}>
          {payments.map((payment) => {
            const booking = bookingsById.get(payment.bookingId);
            const business = businessesById.get(
              booking?.businessId ?? payment.businessId,
            );

            return (
              <View key={payment.id} style={styles.receiptCard}>
                <View style={styles.receiptHeader}>
                  <View style={styles.receiptHeaderCopy}>
                    <Text style={styles.receiptTitle}>
                      {business?.name ?? 'Beauty Finder receipt'}
                    </Text>
                    <Text style={styles.receiptSubtitle}>
                      {booking?.serviceName ?? 'Booked service'} ·{' '}
                      {new Date(payment.paidAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                      {payment.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.receiptMethod}>
                  {formatPaymentMethod(payment)}
                </Text>

                <View style={styles.receiptTotals}>
                  <LineItem
                    label="Subtotal"
                    value={formatCurrency(payment.subtotal, payment.currency)}
                  />
                  <LineItem
                    label="Discount"
                    value={`-${formatCurrency(payment.discount, payment.currency)}`}
                  />
                  <LineItem
                    label="Tax"
                    value={formatCurrency(payment.tax, payment.currency)}
                  />
                  <LineItem
                    label="Tip"
                    value={formatCurrency(payment.tip, payment.currency)}
                  />
                  <LineItem
                    label="Total"
                    value={formatCurrency(payment.total, payment.currency)}
                    strong
                  />
                </View>

                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterLabel}>Receipt</Text>
                  <Text style={styles.receiptFooterValue}>
                    {payment.receiptNumber}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 18,
    backgroundColor: '#ffeef5',
  },
  heroCard: {
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#fff7fb',
    borderWidth: 2,
    borderColor: '#f6c6d9',
    gap: 14,
  },
  eyebrow: {
    color: '#c22767',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#57192f',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroBody: {
    color: '#7e5165',
    fontSize: 15,
    lineHeight: 22,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#8a5670',
    fontSize: 14,
    fontWeight: '600',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 110,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3d8e3',
    gap: 4,
  },
  metricValue: {
    color: '#411123',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#8b6274',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: '#d82f73',
  },
  primaryButtonPressed: {
    backgroundColor: '#bc205f',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1bfd3',
  },
  secondaryButtonPressed: {
    backgroundColor: '#fff4f8',
  },
  secondaryButtonText: {
    color: '#7c1f48',
    fontSize: 14,
    fontWeight: '800',
  },
  receiptBanner: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#ffe3ef',
    borderWidth: 1,
    borderColor: '#f7bdd4',
    gap: 4,
  },
  receiptBannerLabel: {
    color: '#a13d63',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  receiptBannerValue: {
    color: '#601831',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#fff9fc',
    borderWidth: 1,
    borderColor: '#f0cedc',
    gap: 12,
  },
  emptyTitle: {
    color: '#581b33',
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#82586d',
    fontSize: 15,
    lineHeight: 22,
  },
  receiptList: {
    gap: 14,
  },
  receiptCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0dfe7',
    gap: 14,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  receiptHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  receiptTitle: {
    color: '#491628',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  receiptSubtitle: {
    color: '#885d70',
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#ffe5ef',
  },
  statusBadgeText: {
    color: '#c22767',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  receiptMethod: {
    color: '#71384d',
    fontSize: 14,
    fontWeight: '700',
  },
  receiptTotals: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#fff6fa',
    gap: 10,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineItemLabel: {
    color: '#8c6677',
    fontSize: 14,
  },
  lineItemValue: {
    color: '#5c243a',
    fontSize: 14,
    fontWeight: '700',
  },
  lineItemStrong: {
    color: '#411123',
    fontWeight: '800',
  },
  receiptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  receiptFooterLabel: {
    color: '#9b6e80',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  receiptFooterValue: {
    color: '#601831',
    fontSize: 15,
    fontWeight: '800',
  },
});

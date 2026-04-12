import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type {
  NotificationPreferenceRecord,
  NotificationRecord,
  SessionPayload,
} from '@beauty-finder/types';
import {
  fallbackNotificationPreferences,
  fallbackNotifications,
  fetchJson,
  getAuthHeaders,
  isCustomerDemoModeEnabled,
  getStoredSession,
} from '../src/lib/customer-experience';

type PreferenceKey =
  | 'bookingCreated'
  | 'bookingConfirmed'
  | 'messageReceived'
  | 'paymentReceipt'
  | 'reviewReceived'
  | 'system';

const preferenceRows: Array<{
  key: PreferenceKey;
  label: string;
  description: string;
}> = [
  {
    key: 'bookingCreated',
    label: 'Booking created',
    description: 'Send a heads-up right after a booking request is placed.',
  },
  {
    key: 'bookingConfirmed',
    label: 'Booking confirmed',
    description:
      'Keep confirmation updates turned on for approved appointments.',
  },
  {
    key: 'messageReceived',
    label: 'Messages',
    description: 'Alert me when a salon replies in the booking conversation.',
  },
  {
    key: 'paymentReceipt',
    label: 'Payment receipts',
    description:
      'Store receipt and checkout confirmations in the customer inbox.',
  },
  {
    key: 'reviewReceived',
    label: 'Review activity',
    description: 'Track review-related follow-ups for completed bookings.',
  },
  {
    key: 'system',
    label: 'System updates',
    description: 'Receive account-level moderation or platform notices.',
  },
];

function getNotificationTypeLabel(type: NotificationRecord['type']) {
  switch (type) {
    case 'booking_created':
      return 'Booking created';
    case 'booking_confirmed':
      return 'Booking confirmed';
    case 'message_received':
      return 'Message';
    case 'payment_receipt':
      return 'Receipt';
    case 'review_received':
      return 'Review';
    case 'system':
    default:
      return 'System';
  }
}

export default function NotificationsScreen() {
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const demoModeEnabled = isCustomerDemoModeEnabled();
  const [session, setSession] = useState<SessionPayload | null>(() =>
    getStoredSession(),
  );
  const [notifications, setNotifications] = useState<NotificationRecord[]>(
    fallbackNotifications,
  );
  const [preferences, setPreferences] =
    useState<NotificationPreferenceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState(
    'Loading notification inbox and preference toggles...',
  );
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [readingTarget, setReadingTarget] = useState<string | 'all' | null>(
    null,
  );

  useEffect(() => {
    setSession(getStoredSession());
  }, [refresh]);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      if (!session) {
        if (!active) {
          return;
        }

        setNotifications(fallbackNotifications);
        setPreferences(fallbackNotificationPreferences);
        setLoading(false);
        setStatusText('Log in to manage live notification settings.');
        return;
      }

      setLoading(true);
      setStatusText('Syncing your live notification center...');

      try {
        const [nextNotifications, nextPreferences] = await Promise.all([
          fetchJson<NotificationRecord[]>('/notifications', {
            headers: getAuthHeaders(),
          }),
          fetchJson<NotificationPreferenceRecord>(
            '/notifications/preferences',
            {
              headers: getAuthHeaders(),
            },
          ),
        ]);

        if (!active) {
          return;
        }

        setNotifications(nextNotifications ?? fallbackNotifications);
        setPreferences(nextPreferences ?? fallbackNotificationPreferences);
        setStatusText('Live inbox and preference switches are ready.');
      } catch {
        if (!active) {
          return;
        }

        setNotifications(fallbackNotifications);
        setPreferences(fallbackNotificationPreferences);
        setStatusText(
          'Using showcase notification data while the API catches up.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, [session, refresh]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );
  const enabledCount = useMemo(
    () =>
      preferences
        ? preferenceRows.filter((row) => preferences[row.key]).length
        : 0,
    [preferences],
  );

  async function updatePreference(key: PreferenceKey, value: boolean) {
    if (!session || !preferences || savingKey) {
      return;
    }

    const previousPreferences = preferences;
    setSavingKey(key);
    setPreferences({
      ...preferences,
      [key]: value,
    });
    setStatusText(
      `Saving ${preferenceRows.find((row) => row.key === key)?.label ?? 'preference'}...`,
    );

    const nextPreferences = await fetchJson<NotificationPreferenceRecord>(
      '/notifications/preferences',
      {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ [key]: value }),
      },
    );

    if (!nextPreferences) {
      setPreferences(previousPreferences);
      setStatusText('Could not save that preference right now.');
      setSavingKey(null);
      return;
    }

    setPreferences(nextPreferences);
    setStatusText('Notification preferences updated.');
    setSavingKey(null);
  }

  async function markNotificationsRead(
    input: { markAll?: boolean; notificationIds?: string[] },
    target: string | 'all',
  ) {
    if (!session || readingTarget) {
      return;
    }

    setReadingTarget(target);
    setStatusText(
      target === 'all'
        ? 'Marking all notifications as read...'
        : 'Marking notification as read...',
    );

    const nextNotifications = await fetchJson<NotificationRecord[]>(
      '/notifications/read',
      {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(input),
      },
    );

    if (!nextNotifications) {
      setStatusText('Could not update notification read state right now.');
      setReadingTarget(null);
      return;
    }

    setNotifications(nextNotifications);
    setStatusText(
      target === 'all'
        ? 'All notifications are marked as read.'
        : 'Notification marked as read.',
    );
    setReadingTarget(null);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Notifications' }} />

      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Phase 5</Text>
        <Text style={styles.heroTitle}>Notifications and preferences</Text>
        <Text style={styles.heroBody}>{statusText}</Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#c22767" />
            <Text style={styles.loadingText}>
              Loading notification center...
            </Text>
          </View>
        ) : null}

        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{unreadCount}</Text>
            <Text style={styles.metricLabel}>Unread</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{notifications.length}</Text>
            <Text style={styles.metricLabel}>Inbox items</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{enabledCount}</Text>
            <Text style={styles.metricLabel}>Alerts on</Text>
          </View>
        </View>

        <View style={styles.heroActionRow}>
          <Pressable
            onPress={() => void markNotificationsRead({ markAll: true }, 'all')}
            style={({ pressed }) => [
              styles.primaryButton,
              unreadCount === 0 || readingTarget != null
                ? styles.buttonDisabled
                : null,
              pressed ? styles.primaryButtonPressed : null,
            ]}
            disabled={unreadCount === 0 || readingTarget != null}
          >
            <Text style={styles.primaryButtonText}>
              {readingTarget === 'all' ? 'Updating...' : 'Mark all read'}
            </Text>
          </Pressable>
          <Link href="/payments" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Open payments</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {!session ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Customer login required</Text>
          <Text style={styles.emptyBody}>
            {demoModeEnabled
              ? 'Sign in with the local seeded customer account to manage real notification settings and see your live inbox.'
              : 'Sign in with your customer account to manage notification settings and see your live inbox.'}
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
      ) : (
        <>
          <View style={styles.preferenceCard}>
            <Text style={styles.sectionLabel}>Preference panel</Text>
            <Text style={styles.sectionTitle}>Choose which alerts stay on</Text>
            <Text style={styles.sectionBody}>
              These switches write to the new Phase 5 notification preference
              API.
            </Text>

            <View style={styles.preferenceList}>
              {preferenceRows.map((row) => (
                <View key={row.key} style={styles.preferenceRow}>
                  <View style={styles.preferenceCopy}>
                    <Text style={styles.preferenceTitle}>{row.label}</Text>
                    <Text style={styles.preferenceDescription}>
                      {row.description}
                    </Text>
                  </View>
                  <View style={styles.preferenceControl}>
                    {savingKey === row.key ? (
                      <Text style={styles.preferenceSaving}>Saving...</Text>
                    ) : null}
                    <Switch
                      value={preferences?.[row.key] ?? false}
                      onValueChange={(value) =>
                        void updatePreference(row.key, value)
                      }
                      trackColor={{ false: '#f1c4d5', true: '#ef74a3' }}
                      thumbColor="#ffffff"
                      disabled={savingKey != null}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.inboxCard}>
            <Text style={styles.sectionLabel}>Inbox</Text>
            <Text style={styles.sectionTitle}>
              Recent customer notifications
            </Text>
            <Text style={styles.sectionBody}>
              Booking, message, and payment updates land here first.
            </Text>

            <View style={styles.inboxList}>
              {notifications.map((notification) => (
                <View key={notification.id} style={styles.notificationCard}>
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationHeaderCopy}>
                      <Text style={styles.notificationTitle}>
                        {notification.title}
                      </Text>
                      <Text style={styles.notificationMeta}>
                        {getNotificationTypeLabel(notification.type)} ·{' '}
                        {new Date(notification.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.notificationBadge,
                        notification.read
                          ? styles.notificationBadgeRead
                          : styles.notificationBadgeUnread,
                      ]}
                    >
                      <Text
                        style={[
                          styles.notificationBadgeText,
                          notification.read
                            ? styles.notificationBadgeTextRead
                            : styles.notificationBadgeTextUnread,
                        ]}
                      >
                        {notification.read ? 'Read' : 'Unread'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.notificationBody}>
                    {notification.body}
                  </Text>

                  {!notification.read ? (
                    <Pressable
                      onPress={() =>
                        void markNotificationsRead(
                          { notificationIds: [notification.id] },
                          notification.id,
                        )
                      }
                      style={({ pressed }) => [
                        styles.inlineButton,
                        readingTarget === notification.id
                          ? styles.buttonDisabled
                          : null,
                        pressed ? styles.inlineButtonPressed : null,
                      ]}
                      disabled={readingTarget != null}
                    >
                      <Text style={styles.inlineButtonText}>
                        {readingTarget === notification.id
                          ? 'Updating...'
                          : 'Mark read'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </>
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
  buttonDisabled: {
    opacity: 0.55,
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
  preferenceCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0dfe7',
    gap: 14,
  },
  sectionLabel: {
    color: '#c22767',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#54182f',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '800',
  },
  sectionBody: {
    color: '#7e5467',
    fontSize: 15,
    lineHeight: 22,
  },
  preferenceList: {
    gap: 12,
  },
  preferenceRow: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#fff6fa',
    borderWidth: 1,
    borderColor: '#f5d7e3',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  preferenceCopy: {
    flex: 1,
    gap: 4,
  },
  preferenceTitle: {
    color: '#5a1d35',
    fontSize: 16,
    fontWeight: '800',
  },
  preferenceDescription: {
    color: '#8a6174',
    fontSize: 13,
    lineHeight: 19,
  },
  preferenceControl: {
    alignItems: 'flex-end',
    gap: 6,
  },
  preferenceSaving: {
    color: '#c22767',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inboxCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0dfe7',
    gap: 14,
  },
  inboxList: {
    gap: 12,
  },
  notificationCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#fff7fb',
    borderWidth: 1,
    borderColor: '#f4d6e2',
    gap: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  notificationHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    color: '#4f152a',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  notificationMeta: {
    color: '#8c6477',
    fontSize: 13,
    lineHeight: 18,
  },
  notificationBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  notificationBadgeUnread: {
    backgroundColor: '#ffe1ec',
  },
  notificationBadgeRead: {
    backgroundColor: '#f3ebef',
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  notificationBadgeTextUnread: {
    color: '#c22767',
  },
  notificationBadgeTextRead: {
    color: '#876879',
  },
  notificationBody: {
    color: '#6e4154',
    fontSize: 15,
    lineHeight: 22,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffdbe8',
  },
  inlineButtonPressed: {
    backgroundColor: '#f7c6d8',
  },
  inlineButtonText: {
    color: '#a12056',
    fontSize: 13,
    fontWeight: '800',
  },
});

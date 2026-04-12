import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SessionPayload } from '@beauty-finder/types';
import {
  fetchJson,
  getApiBaseUrl,
  getApiUnavailableMessage,
  isCustomerDemoModeEnabled,
  saveStoredSession,
} from '../src/lib/customer-experience';
import { HelloKittySticker } from '../src/components/hello-kitty-sticker';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = normalizeParam(params.mode) === 'signup' ? 'signup' : 'login';
  const isSignup = mode === 'signup';
  const demoModeEnabled = isCustomerDemoModeEnabled();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(demoModeEnabled ? 'ava@beautyfinder.app' : '');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [password, setPassword] = useState(
    isSignup ? 'Beauty123' : demoModeEnabled ? 'mock-password' : '',
  );
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState(
    isSignup
      ? 'Create a customer session to save favorites and book faster.'
      : 'Log in to keep your bookings, favorites, and salon updates together.',
  );

  async function handleContinue() {
    if (pending) {
      return;
    }

    if (!getApiBaseUrl()) {
      setStatusText(getApiUnavailableMessage());
      return;
    }

    setPending(true);
    setStatusText(
      isSignup ? 'Starting your customer account...' : 'Signing you in...',
    );

    try {
      const session = await fetchJson<SessionPayload>(
        isSignup ? '/auth/register/customer' : '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isSignup
              ? {
                  fullName: fullName.trim(),
                  email: email.trim(),
                  password,
                  phone: phone.trim() || undefined,
                  avatarUrl: avatarUrl.trim() || undefined,
                }
              : {
                  email: email.trim(),
                  password,
                },
          ),
        },
      );

      if (!session) {
        setStatusText(
          isSignup
            ? 'The customer account could not be created. Check the API and try again.'
            : 'The sign-in request failed. Check your email/password and try again.',
        );
        return;
      }

      saveStoredSession(session);
      router.replace({
        pathname: '/',
        params: { refresh: `${Date.now()}` },
      });
    } catch {
      setStatusText('Could not reach the auth endpoint right now.');
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{ title: mode === 'signup' ? 'Create account' : 'Log in' }}
      />

      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>
          {isSignup ? 'Customer Sign Up' : 'Customer Sign In'}
        </Text>
        <Text style={styles.title}>
          {isSignup
            ? demoModeEnabled
              ? 'Start with the local seeded account and keep the app flow moving.'
              : 'Create a real customer account and keep the app flow moving.'
            : demoModeEnabled
              ? 'Use the local seeded customer session to test the real app flow.'
              : 'Sign in with your real customer account.'}
        </Text>
        <Text style={styles.body}>
          {demoModeEnabled
            ? 'This mobile app now uses the real auth endpoints. The local seeded customer login is `ava@beautyfinder.app` with password `mock-password`. New sign-up passwords must include uppercase, lowercase, and a number.'
            : 'This mobile app now uses the real auth endpoints for this environment. New sign-up passwords must include uppercase, lowercase, and a number.'}
        </Text>

        <View style={styles.mascotPanel}>
          <HelloKittySticker size={120} style={styles.mascot} />
          <View style={styles.mascotCopy}>
            <Text style={styles.mascotEyebrow}>Cute Loop</Text>
            <Text style={styles.mascotTitle}>A softer sign-in moment.</Text>
            <Text style={styles.mascotBody}>
              Keep the welcome energy here too, while the form stays simple and
              fast.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          {isSignup ? (
            <>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={setFullName}
                placeholder="Ava Tran"
                placeholderTextColor="#9a8d8a"
                style={styles.input}
                value={fullName}
              />
            </>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder={demoModeEnabled ? 'ava@beautyfinder.app' : 'you@example.com'}
            placeholderTextColor="#9a8d8a"
            style={styles.input}
            value={email}
          />

          {isSignup ? (
            <>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="555-0101"
                placeholderTextColor="#9a8d8a"
                style={styles.input}
                value={phone}
              />

              <Text style={styles.label}>Avatar URL</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setAvatarUrl}
                placeholder="https://images.example.com/ava.jpg"
                placeholderTextColor="#9a8d8a"
                style={styles.input}
                value={avatarUrl}
              />
            </>
          ) : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPassword}
            placeholder={isSignup ? 'Beauty123' : demoModeEnabled ? 'mock-password' : 'Password'}
            placeholderTextColor="#9a8d8a"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed || pending ? styles.primaryButtonPressed : null,
            ]}
          >
            {pending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignup ? 'Create and continue' : 'Log in and continue'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              router.replace({
                pathname: '/auth',
                params: { mode: isSignup ? 'login' : 'signup' },
              });
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.secondaryButtonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isSignup
                ? 'Already have an account? Log in'
                : 'New here? Create customer account'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.replace('/');
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.secondaryButtonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Back to home</Text>
          </Pressable>
        </View>

        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: '#f8f2ed',
    paddingHorizontal: 20,
    paddingVertical: 28,
    justifyContent: 'center',
  },
  heroCard: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    backgroundColor: '#fffaf6',
    borderRadius: 28,
    padding: 26,
    gap: 16,
    borderWidth: 1,
    borderColor: '#eedfd7',
    shadowColor: '#2d0d17',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: {
    color: '#b12b3f',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1f1b1a',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  body: {
    color: '#5f5654',
    fontSize: 16,
    lineHeight: 24,
  },
  mascotPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff1f6',
    borderWidth: 1,
    borderColor: '#f2d7e3',
  },
  mascot: {
    flexShrink: 0,
  },
  mascotCopy: {
    flex: 1,
    gap: 4,
  },
  mascotEyebrow: {
    color: '#c22767',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mascotTitle: {
    color: '#2c1f25',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  mascotBody: {
    color: '#6b5860',
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#efe4de',
    padding: 18,
  },
  label: {
    color: '#6e5a55',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eadbd3',
    backgroundColor: '#fff9f6',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#1f1b1a',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#e12727',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    backgroundColor: '#bf1e1e',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d8c8c1',
    backgroundColor: '#fff5f1',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonPressed: {
    backgroundColor: '#f7eae3',
  },
  secondaryButtonText: {
    color: '#5e4c47',
    fontSize: 15,
    fontWeight: '700',
  },
  statusText: {
    color: '#6e5d59',
    fontSize: 14,
    lineHeight: 21,
  },
});

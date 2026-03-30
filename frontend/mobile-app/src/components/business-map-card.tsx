import { createElement } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BusinessSummary } from '@beauty-finder/types';
import {
  formatBusinessAddress,
  getBusinessGoogleMapsUrl,
  getBusinessMapEmbedUrl,
} from '../lib/customer-experience';

export function BusinessMapCard({
  business,
  height = 220,
  title = 'Map preview',
  subtitle = 'See the salon location before you book.',
  buttonLabel = 'Open in Google Maps',
}: {
  business: BusinessSummary;
  height?: number;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
}) {
  const address = formatBusinessAddress(business);
  const mapsUrl = getBusinessGoogleMapsUrl(business);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.address}>{address}</Text>
      </View>

      <View style={[styles.frame, { minHeight: height }]}>
        {Platform.OS === 'web' ? (
          createElement('iframe', {
            title: `${business.name} map`,
            src: getBusinessMapEmbedUrl(business),
            loading: 'lazy',
            referrerPolicy: 'no-referrer-when-downgrade',
            style: {
              border: 0,
              width: '100%',
              height: '100%',
              borderRadius: '20px',
            },
          })
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackTitle}>Map preview</Text>
            <Text style={styles.fallbackBody}>
              Open Google Maps to see the salon route on your phone.
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={() => {
          void Linking.openURL(mapsUrl);
        }}
        style={({ pressed }) => [
          styles.button,
          pressed ? styles.buttonPressed : null,
        ]}
      >
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    backgroundColor: '#fff4f8',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f7c2d5',
  },
  header: {
    gap: 3,
  },
  title: {
    color: '#341b36',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8d6a82',
    fontSize: 12,
    lineHeight: 18,
  },
  address: {
    color: '#7a586e',
    fontSize: 12,
    lineHeight: 18,
  },
  frame: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#ffe3ee',
    borderWidth: 1,
    borderColor: '#f0bdd0',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 6,
    backgroundColor: '#ffe7f0',
  },
  fallbackTitle: {
    color: '#341b36',
    fontSize: 16,
    fontWeight: '800',
  },
  fallbackBody: {
    color: '#8d6a82',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5e95',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#fffafc',
    fontSize: 13,
    fontWeight: '800',
  },
});

import type { BusinessSummary } from '@beauty-finder/types';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

type BrandTone = 'light' | 'dark';
type BrandSize = 'hero' | 'card' | 'detail';

type BeautyFinderWordmarkProps = {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: BrandTone;
};

type BeautyFinderNavbarBrandProps = {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: BrandTone;
};

type BusinessLogoPanelProps = {
  business: BusinessSummary;
  size?: BrandSize;
  style?: StyleProp<ViewStyle>;
  tone?: BrandTone;
};

type BrandPalette = {
  background: string;
  badgeBackground: string;
  badgeDot: string;
  badgeText: string;
  border: string;
  categoryText: string;
  descriptor: string;
  footerBorder: string;
  meta: string;
  monogramCore: string;
  monogramShell: string;
  monogramText: string;
  name: string;
};

const fillerWords = new Set([
  'and',
  'atelier',
  'bar',
  'beauty',
  'club',
  'finder',
  'house',
  'salon',
  'shop',
  'spa',
  'studio',
  'the',
]);

function getBusinessMonogram(name: string) {
  const tokens = name
    .split(/[^A-Za-z0-9]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  const meaningfulTokens = tokens.filter(
    (token) => !fillerWords.has(token.toLowerCase()),
  );
  const source = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;

  if (source.length >= 2) {
    return `${source[0]?.[0] ?? ''}${source[1]?.[0] ?? ''}`.toUpperCase();
  }

  if (source.length === 1) {
    return source[0]!.slice(0, 2).toUpperCase();
  }

  return 'BF';
}

function getBusinessPalette(
  category: BusinessSummary['category'],
  tone: BrandTone,
): BrandPalette {
  if (category === 'hair') {
    return tone === 'dark'
      ? {
          background: 'rgba(17, 27, 25, 0.82)',
          badgeBackground: 'rgba(220, 234, 228, 0.12)',
          badgeDot: '#c9e3d9',
          badgeText: '#dfeae5',
          border: 'rgba(223, 234, 229, 0.18)',
          categoryText: '#bdd1ca',
          descriptor: '#b7c7c1',
          footerBorder: 'rgba(223, 234, 229, 0.12)',
          meta: '#dce5e0',
          monogramCore: '#d9ebe5',
          monogramShell: 'rgba(223, 234, 229, 0.1)',
          monogramText: '#19332e',
          name: '#ffffff',
        }
      : {
          background: '#fbfcfa',
          badgeBackground: '#edf5f1',
          badgeDot: '#31554d',
          badgeText: '#31554d',
          border: '#d8e4dd',
          categoryText: '#64756f',
          descriptor: '#60706a',
          footerBorder: '#e2ece7',
          meta: '#55635f',
          monogramCore: '#24433d',
          monogramShell: '#dfe9e5',
          monogramText: '#f8fbfa',
          name: '#17211f',
        };
  }

  return tone === 'dark'
    ? {
        background: 'rgba(30, 19, 24, 0.84)',
        badgeBackground: 'rgba(247, 220, 230, 0.12)',
        badgeDot: '#f5d1de',
        badgeText: '#f6dde6',
        border: 'rgba(246, 221, 230, 0.18)',
        categoryText: '#e5c1cf',
        descriptor: '#ccb7bf',
        footerBorder: 'rgba(246, 221, 230, 0.12)',
        meta: '#e6dde1',
        monogramCore: '#f6dae4',
        monogramShell: 'rgba(246, 221, 230, 0.1)',
        monogramText: '#5e2a3b',
        name: '#ffffff',
      }
    : {
        background: '#fff9fb',
        badgeBackground: '#f9e8ef',
        badgeDot: '#8b3957',
        badgeText: '#8b3957',
        border: '#eed7df',
        categoryText: '#956b7b',
        descriptor: '#8c6775',
        footerBorder: '#f3e4ea',
        meta: '#745a65',
        monogramCore: '#7b3048',
        monogramShell: '#f5dde6',
        monogramText: '#fff9fb',
        name: '#2d1820',
      };
}

function getBusinessDescriptor(business: BusinessSummary) {
  const firstService = business.services[0]?.name;

  if (firstService) {
    return `${business.services.length} services led by ${firstService}`;
  }

  return `${business.reviewCount} verified client reviews`;
}

export function BeautyFinderWordmark({
  compact = false,
  style,
  tone = 'dark',
}: BeautyFinderWordmarkProps) {
  const darkTone = tone === 'dark';

  return (
    <View style={[styles.wordmarkRow, compact ? styles.wordmarkRowCompact : null, style]}>
      <View
        style={[
          styles.wordmarkBadge,
          compact ? styles.wordmarkBadgeCompact : null,
          darkTone ? styles.wordmarkBadgeDark : styles.wordmarkBadgeLight,
        ]}
      >
        <Text
          style={[
            styles.wordmarkBadgeText,
            compact ? styles.wordmarkBadgeTextCompact : null,
            darkTone ? styles.wordmarkBadgeTextDark : styles.wordmarkBadgeTextLight,
          ]}
        >
          BF
        </Text>
      </View>
      <View style={styles.wordmarkCopy}>
        <Text
          style={[
            styles.wordmarkTitle,
            compact ? styles.wordmarkTitleCompact : null,
            darkTone ? styles.wordmarkTitleDark : styles.wordmarkTitleLight,
          ]}
        >
          Beauty Finder
        </Text>
        <Text
          style={[
            styles.wordmarkSubtitle,
            darkTone ? styles.wordmarkSubtitleDark : styles.wordmarkSubtitleLight,
          ]}
        >
          Curated salon booking
        </Text>
      </View>
    </View>
  );
}

export function BeautyFinderNavbarBrand({
  compact = false,
  style,
  tone = 'dark',
}: BeautyFinderNavbarBrandProps) {
  const darkTone = tone === 'dark';

  return (
    <View
      style={[
        styles.navbarBrandRow,
        compact ? styles.navbarBrandRowCompact : null,
        style,
      ]}
    >
      <View
        style={[
          styles.navbarBrandMarkShell,
          compact ? styles.navbarBrandMarkShellCompact : null,
          darkTone
            ? styles.navbarBrandMarkShellDark
            : styles.navbarBrandMarkShellLight,
        ]}
      >
        <View
          style={[
            styles.navbarBrandMarkCore,
            compact ? styles.navbarBrandMarkCoreCompact : null,
            darkTone
              ? styles.navbarBrandMarkCoreDark
              : styles.navbarBrandMarkCoreLight,
          ]}
        >
          <Text
            style={[
              styles.navbarBrandMarkText,
              compact ? styles.navbarBrandMarkTextCompact : null,
              darkTone
                ? styles.navbarBrandMarkTextDark
                : styles.navbarBrandMarkTextLight,
            ]}
          >
            Bf
          </Text>
        </View>
      </View>

      {compact ? null : (
        <View
          style={[
            styles.navbarBrandMeta,
            darkTone ? styles.navbarBrandMetaDark : styles.navbarBrandMetaLight,
          ]}
        >
          <Text
            style={[
              styles.navbarBrandEyebrow,
              darkTone
                ? styles.navbarBrandEyebrowDark
                : styles.navbarBrandEyebrowLight,
            ]}
          >
            Beauty marketplace
          </Text>
          <Text
            style={[
              styles.navbarBrandCaption,
              darkTone
                ? styles.navbarBrandCaptionDark
                : styles.navbarBrandCaptionLight,
            ]}
          >
            Curated booking
          </Text>
        </View>
      )}
    </View>
  );
}

export function BusinessLogoPanel({
  business,
  size = 'card',
  style,
  tone = 'light',
}: BusinessLogoPanelProps) {
  const palette = getBusinessPalette(business.category, tone);
  const monogram = getBusinessMonogram(business.name);
  const isHero = size === 'hero';
  const isCard = size === 'card';

  return (
    <View
      style={[
        styles.panel,
        isHero ? styles.panelHero : null,
        size === 'detail' ? styles.panelDetail : null,
        isCard ? styles.panelCard : null,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <View style={styles.panelTopRow}>
        <View
          style={[
            styles.panelBadge,
            { backgroundColor: palette.badgeBackground },
          ]}
        >
          <View
            style={[
              styles.panelBadgeDot,
              { backgroundColor: palette.badgeDot },
            ]}
          />
          <Text style={[styles.panelBadgeText, { color: palette.badgeText }]}>
            Verified profile
          </Text>
        </View>
        <Text style={[styles.panelCategoryText, { color: palette.categoryText }]}>
          {business.category === 'hair' ? 'Hair salon' : 'Nail salon'}
        </Text>
      </View>

      <View style={styles.panelBody}>
        <View
          style={[
            styles.monogramShell,
            isHero ? styles.monogramShellHero : null,
            size === 'detail' ? styles.monogramShellDetail : null,
            {
              backgroundColor: palette.monogramShell,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[
              styles.monogramCore,
              isHero ? styles.monogramCoreHero : null,
              size === 'detail' ? styles.monogramCoreDetail : null,
              { backgroundColor: palette.monogramCore },
            ]}
          >
            <Text
              style={[
                styles.monogramText,
                isHero ? styles.monogramTextHero : null,
                size === 'detail' ? styles.monogramTextDetail : null,
                { color: palette.monogramText },
              ]}
            >
              {monogram}
            </Text>
          </View>
        </View>

        <View style={styles.panelCopy}>
          <Text
            numberOfLines={isHero ? 2 : 1}
            style={[
              styles.panelName,
              isHero ? styles.panelNameHero : null,
              size === 'detail' ? styles.panelNameDetail : null,
              { color: palette.name },
            ]}
          >
            {business.name}
          </Text>
          <Text style={[styles.panelMeta, { color: palette.meta }]}>
            {business.city}, {business.state}
          </Text>
          <Text
            numberOfLines={isHero ? 2 : 1}
            style={[styles.panelDescriptor, { color: palette.descriptor }]}
          >
            {getBusinessDescriptor(business)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.panelFooter,
          isCard ? styles.panelFooterCard : null,
          { borderTopColor: palette.footerBorder },
        ]}
      >
        {isCard ? (
          <Text style={[styles.panelFooterText, { color: palette.descriptor }]}>
            {business.reviewCount} client reviews
          </Text>
        ) : (
          <BeautyFinderWordmark compact tone={tone} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wordmarkRowCompact: {
    gap: 10,
  },
  wordmarkBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkBadgeCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  wordmarkBadgeDark: {
    backgroundColor: '#f7efe3',
  },
  wordmarkBadgeLight: {
    backgroundColor: '#171717',
  },
  wordmarkBadgeText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  wordmarkBadgeTextCompact: {
    fontSize: 16,
  },
  wordmarkBadgeTextDark: {
    color: '#171717',
  },
  wordmarkBadgeTextLight: {
    color: '#fffdf9',
  },
  wordmarkCopy: {
    gap: 1,
  },
  wordmarkTitle: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  wordmarkTitleCompact: {
    fontSize: 18,
    lineHeight: 20,
  },
  wordmarkTitleDark: {
    color: '#ffffff',
  },
  wordmarkTitleLight: {
    color: '#171717',
  },
  wordmarkSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  wordmarkSubtitleDark: {
    color: 'rgba(255,255,255,0.72)',
  },
  wordmarkSubtitleLight: {
    color: '#6f6b64',
  },
  navbarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  navbarBrandRowCompact: {
    gap: 0,
  },
  navbarBrandMarkShell: {
    borderRadius: 18,
    padding: 3,
    borderWidth: 1,
  },
  navbarBrandMarkShellCompact: {
    borderRadius: 16,
  },
  navbarBrandMarkShellDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  navbarBrandMarkShellLight: {
    backgroundColor: 'rgba(20,22,25,0.05)',
    borderColor: 'rgba(20,22,25,0.08)',
  },
  navbarBrandMarkCore: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarBrandMarkCoreCompact: {
    width: 40,
    height: 40,
    borderRadius: 14,
  },
  navbarBrandMarkCoreDark: {
    backgroundColor: '#f4e8dc',
  },
  navbarBrandMarkCoreLight: {
    backgroundColor: '#171717',
  },
  navbarBrandMarkText: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  navbarBrandMarkTextCompact: {
    fontSize: 18,
    lineHeight: 18,
  },
  navbarBrandMarkTextDark: {
    color: '#241a16',
  },
  navbarBrandMarkTextLight: {
    color: '#fbf7f1',
  },
  navbarBrandMeta: {
    paddingLeft: 14,
    gap: 2,
    borderLeftWidth: 1,
  },
  navbarBrandMetaDark: {
    borderLeftColor: 'rgba(255,255,255,0.1)',
  },
  navbarBrandMetaLight: {
    borderLeftColor: 'rgba(20,22,25,0.08)',
  },
  navbarBrandEyebrow: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  navbarBrandEyebrowDark: {
    color: 'rgba(255,255,255,0.55)',
  },
  navbarBrandEyebrowLight: {
    color: '#6e645d',
  },
  navbarBrandCaption: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  navbarBrandCaptionDark: {
    color: '#f6efe7',
  },
  navbarBrandCaptionLight: {
    color: '#171717',
  },
  panel: {
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
  },
  panelHero: {
    padding: 22,
    gap: 18,
  },
  panelDetail: {
    padding: 18,
    gap: 14,
  },
  panelCard: {
    padding: 18,
    gap: 14,
  },
  panelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  panelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  panelBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  panelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  panelCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  panelBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  monogramShell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  monogramShellHero: {
    width: 110,
    height: 110,
  },
  monogramShellDetail: {
    width: 78,
    height: 78,
  },
  monogramCore: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    width: 70,
    height: 70,
  },
  monogramCoreHero: {
    width: 78,
    height: 78,
    borderRadius: 24,
  },
  monogramCoreDetail: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  monogramText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  monogramTextHero: {
    fontSize: 34,
    letterSpacing: 2.8,
  },
  monogramTextDetail: {
    fontSize: 24,
    letterSpacing: 2,
  },
  panelCopy: {
    flex: 1,
    gap: 5,
  },
  panelName: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  panelNameHero: {
    fontSize: 30,
    lineHeight: 34,
  },
  panelNameDetail: {
    fontSize: 22,
    lineHeight: 25,
  },
  panelMeta: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  panelDescriptor: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  panelFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
  },
  panelFooterCard: {
    paddingTop: 0,
    borderTopWidth: 0,
  },
  panelFooterText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});

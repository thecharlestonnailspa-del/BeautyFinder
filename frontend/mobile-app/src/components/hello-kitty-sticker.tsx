import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

type HelloKittyStickerProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const helloKittyWink = require("../../assets/branding/hello-kitty-wink.png");

function FloatingHeart({
  color,
  size,
  style,
}: {
  color: string;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const lobeSize = size * 0.58;
  const diamondSize = size * 0.54;

  return (
    <Animated.View
      style={[styles.heartShell, { width: size, height: size }, style]}
    >
      <Animated.View
        style={[
          styles.heartLobe,
          {
            width: lobeSize,
            height: lobeSize,
            backgroundColor: color,
            left: size * 0.08,
            top: size * 0.06,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.heartLobe,
          {
            width: lobeSize,
            height: lobeSize,
            backgroundColor: color,
            right: size * 0.08,
            top: size * 0.06,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.heartDiamond,
          {
            width: diamondSize,
            height: diamondSize,
            backgroundColor: color,
            bottom: size * 0.08,
            marginLeft: -(diamondSize / 2),
          },
        ]}
      />
    </Animated.View>
  );
}

export function HelloKittySticker({
  size = 92,
  style,
}: HelloKittyStickerProps) {
  const motion = useRef(new Animated.Value(0)).current;
  const accent = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const kittyAnimation = Animated.loop(
      Animated.timing(motion, {
        toValue: 1,
        duration: 2800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const accentAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(accent, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(accent, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    kittyAnimation.start();
    accentAnimation.start();

    return () => {
      kittyAnimation.stop();
      accentAnimation.stop();
      motion.stopAnimation();
      accent.stopAnimation();
      motion.setValue(0);
      accent.setValue(0);
    };
  }, [accent, motion]);

  const translateY = motion.interpolate({
    inputRange: [0, 0.18, 0.4, 0.64, 0.82, 1],
    outputRange: [0, -15, -4, -13, -7, 0],
  });
  const translateX = motion.interpolate({
    inputRange: [0, 0.2, 0.5, 0.78, 1],
    outputRange: [0, 6, 0, -6, 0],
  });
  const rotate = motion.interpolate({
    inputRange: [0, 0.18, 0.38, 0.58, 0.78, 1],
    outputRange: ["-6deg", "4deg", "-2deg", "5deg", "-4deg", "-6deg"],
  });
  const scale = motion.interpolate({
    inputRange: [0, 0.2, 0.42, 0.72, 1],
    outputRange: [0.98, 1.08, 1, 1.06, 0.98],
  });
  const glowOpacity = motion.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1],
    outputRange: [0.22, 0.48, 0.28, 0.52, 0.22],
  });
  const sparkleScale = motion.interpolate({
    inputRange: [0, 0.16, 0.32, 0.5, 0.72, 1],
    outputRange: [0.4, 1.05, 0.55, 1.18, 0.68, 0.4],
  });
  const sparkleOpacity = motion.interpolate({
    inputRange: [0, 0.14, 0.32, 0.5, 0.72, 1],
    outputRange: [0.08, 0.88, 0.24, 0.94, 0.3, 0.08],
  });
  const accentTranslate = motion.interpolate({
    inputRange: [0, 0.3, 0.55, 0.8, 1],
    outputRange: [0, -3, 2, -2, 0],
  });
  const heartOneOpacity = accent.interpolate({
    inputRange: [0, 0.16, 0.42, 0.78, 1],
    outputRange: [0.08, 0.84, 0.96, 0.34, 0.08],
  });
  const heartOneScale = accent.interpolate({
    inputRange: [0, 0.16, 0.42, 0.78, 1],
    outputRange: [0.32, 0.82, 1.08, 0.7, 0.32],
  });
  const heartOneTranslateY = accent.interpolate({
    inputRange: [0, 0.2, 0.5, 0.82, 1],
    outputRange: [0, -8, -22, -34, -42],
  });
  const heartOneTranslateX = accent.interpolate({
    inputRange: [0, 0.2, 0.5, 0.82, 1],
    outputRange: [0, 5, 10, 14, 16],
  });
  const heartTwoOpacity = accent.interpolate({
    inputRange: [0, 0.22, 0.52, 0.86, 1],
    outputRange: [0.05, 0.62, 0.84, 0.28, 0.05],
  });
  const heartTwoScale = accent.interpolate({
    inputRange: [0, 0.22, 0.52, 0.86, 1],
    outputRange: [0.26, 0.68, 0.92, 0.58, 0.26],
  });
  const heartTwoTranslateY = accent.interpolate({
    inputRange: [0, 0.24, 0.52, 0.86, 1],
    outputRange: [0, -6, -16, -28, -36],
  });
  const heartTwoTranslateX = accent.interpolate({
    inputRange: [0, 0.24, 0.52, 0.86, 1],
    outputRange: [0, -4, -8, -12, -14],
  });
  const haloScale = motion.interpolate({
    inputRange: [0, 0.22, 0.5, 0.76, 1],
    outputRange: [0.94, 1.1, 0.98, 1.08, 0.94],
  });
  const haloOpacity = motion.interpolate({
    inputRange: [0, 0.22, 0.5, 0.76, 1],
    outputRange: [0.18, 0.34, 0.22, 0.32, 0.18],
  });

  return (
    <Animated.View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }],
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.heartAnchorRight,
          {
            opacity: heartOneOpacity,
            transform: [
              { translateX: heartOneTranslateX },
              { translateY: heartOneTranslateY },
              { scale: heartOneScale },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
        <FloatingHeart color="#ff6fa7" size={24} />
      </Animated.View>
      <Animated.View
        style={[
          styles.heartAnchorLeft,
          {
            opacity: heartTwoOpacity,
            transform: [
              { translateX: heartTwoTranslateX },
              { translateY: heartTwoTranslateY },
              { scale: heartTwoScale },
            ],
          },
        ]}
      >
        <FloatingHeart color="#ffc1dc" size={18} />
      </Animated.View>
      <Animated.Image
        source={helloKittyWink}
        resizeMode="contain"
        style={styles.image}
      />
      <Animated.View
        style={[
          styles.sparkle,
          styles.sparklePrimary,
          {
            opacity: sparkleOpacity,
            transform: [
              { translateY: accentTranslate },
              { scale: sparkleScale },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.sparkleBar, styles.sparkleBarVertical]} />
        <Animated.View
          style={[styles.sparkleBar, styles.sparkleBarHorizontal]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sparkle,
          styles.sparkleSecondary,
          {
            opacity: glowOpacity,
            transform: [{ translateX: accentTranslate }, { scale }],
          },
        ]}
      >
        <Animated.View
          style={[styles.sparkleBar, styles.sparkleBarVerticalSmall]}
        />
        <Animated.View
          style={[styles.sparkleBar, styles.sparkleBarHorizontalSmall]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: 999,
  },
  halo: {
    position: "absolute",
    width: "108%",
    height: "108%",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 230, 0.55)",
  },
  heartShell: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  heartAnchorRight: {
    position: "absolute",
    top: "34%",
    right: "12%",
    zIndex: 2,
  },
  heartAnchorLeft: {
    position: "absolute",
    top: "20%",
    left: "14%",
    zIndex: 2,
  },
  heartLobe: {
    position: "absolute",
    borderRadius: 999,
  },
  heartDiamond: {
    position: "absolute",
    left: "50%",
    transform: [{ rotate: "45deg" }],
  },
  glow: {
    position: "absolute",
    width: "66%",
    height: "66%",
    borderRadius: 999,
    backgroundColor: "rgba(255, 210, 228, 0.9)",
  },
  image: {
    width: "100%",
    height: "100%",
    shadowColor: "#ff5da2",
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
  },
  sparkle: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  sparklePrimary: {
    top: "30%",
    right: "18%",
    width: 22,
    height: 22,
  },
  sparkleSecondary: {
    top: "18%",
    right: "33%",
    width: 14,
    height: 14,
  },
  sparkleBar: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#ffd84d",
  },
  sparkleBarVertical: {
    width: 6,
    height: "100%",
  },
  sparkleBarHorizontal: {
    width: "100%",
    height: 6,
  },
  sparkleBarVerticalSmall: {
    width: 4,
    height: "100%",
  },
  sparkleBarHorizontalSmall: {
    width: "100%",
    height: 4,
  },
});

import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type BeautyMotionVariant = "banner" | "loading";

type BeautyMotionProps = {
  variant?: BeautyMotionVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const variantSize: Record<BeautyMotionVariant, number> = {
  banner: 136,
  loading: 76,
};

const variantTone = {
  banner: {
    shell: "rgba(255, 255, 255, 0.12)",
    border: "rgba(255, 255, 255, 0.18)",
    glow: "#ffc1db",
    ring: "#fff4f8",
    core: "#ffffff",
    orb: "#f7d288",
  },
  loading: {
    shell: "#fff5fa",
    border: "#f3ccda",
    glow: "#ffd8e8",
    ring: "#ff7ea8",
    core: "#ffffff",
    orb: "#f7bfd3",
  },
} satisfies Record<
  BeautyMotionVariant,
  {
    shell: string;
    border: string;
    glow: string;
    ring: string;
    core: string;
    orb: string;
  }
>;

export function BeautyMotion({
  variant = "loading",
  size,
  style,
}: BeautyMotionProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => {
      animation.stop();
      progress.stopAnimation();
      progress.setValue(0);
    };
  }, [progress]);

  const dimension = size ?? variantSize[variant];
  const tone = variantTone[variant];
  const pulse = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.92, 1.08, 0.92],
  });
  const spin = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const shimmer = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 0.92, 0.5],
  });
  const orbitX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 7, 0, -7, 0],
  });
  const orbitY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-7, 0, 7, 0, -7],
  });

  return (
    <View
      style={[
        styles.shell,
        {
          width: dimension,
          height: dimension,
          backgroundColor: tone.shell,
          borderColor: tone.border,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: tone.glow,
            opacity: shimmer,
            transform: [{ scale: pulse }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: tone.ring,
            transform: [{ rotate: spin }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            backgroundColor: tone.orb,
            transform: [
              { translateX: orbitX },
              { translateY: orbitY },
              { scale: pulse },
            ],
          },
        ]}
      />
      <View style={[styles.core, { backgroundColor: tone.core }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: "78%",
    height: "78%",
    borderRadius: 999,
  },
  ring: {
    position: "absolute",
    width: "86%",
    height: "86%",
    borderRadius: 999,
    borderWidth: 3,
  },
  orb: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  core: {
    width: "34%",
    height: "34%",
    borderRadius: 999,
  },
});

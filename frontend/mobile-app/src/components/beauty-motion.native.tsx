import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";

type BeautyMotionVariant = "banner" | "loading";

type BeautyMotionProps = {
  variant?: BeautyMotionVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const beautyRibbonBloom = require("../../assets/lottie/beauty-ribbon-bloom.json");

export function BeautyMotion({
  variant = "loading",
  size,
  style,
}: BeautyMotionProps) {
  const dimension = size ?? (variant === "banner" ? 136 : 76);

  return (
    <View
      style={[
        styles.shell,
        variant === "banner" ? styles.bannerShell : styles.loadingShell,
        { width: dimension, height: dimension },
        style,
      ]}
    >
      <LottieView
        autoPlay
        loop
        source={beautyRibbonBloom}
        style={styles.animation}
      />
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
  bannerShell: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  loadingShell: {
    backgroundColor: "#fff5fa",
    borderColor: "#f3ccda",
  },
  animation: {
    width: "122%",
    height: "122%",
  },
});

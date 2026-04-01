import { type ReactNode, useEffect, useLayoutEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const SPRING = {
  damping: 17,
  stiffness: 128,
  mass: 0.75,
};

type RevisionFlipCardProps = {
  /** Zmiana klucza resetuje obrót (nowa fiszka). */
  cardKey: string;
  isFlipped: boolean;
  /** Wysokość „sceny” obrotu (px). */
  height: number;
  front: ReactNode;
  back: ReactNode;
};

/**
 * Fiszka 3D (przód / tył) z płynną animacją obrotu (react-native-reanimated).
 */
export function RevisionFlipCard({
  cardKey,
  isFlipped,
  height,
  front,
  back,
}: RevisionFlipCardProps) {
  const spin = useSharedValue(0);

  useLayoutEffect(() => {
    spin.value = 0;
  }, [cardKey, spin]);

  useEffect(() => {
    spin.value = withSpring(isFlipped ? 180 : 0, SPRING);
  }, [isFlipped, spin]);

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(spin.value, [0, 180], [0, 180]);
    return {
      transform: [{ perspective: 1400 }, { rotateY: `${rotateY}deg` }],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(spin.value, [0, 180], [180, 360]);
    return {
      transform: [{ perspective: 1400 }, { rotateY: `${rotateY}deg` }],
    };
  });

  /**
   * Druga warstwa w DOM jest domyślnie „nad” pierwszą, bez pointerEvents tyl
   * przechwytuje klik (np. mysz na symulatorze), mimo że wizualnie widać przód.
   */
  const frontPointer = isFlipped ? "none" : "auto";
  const backPointer = isFlipped ? "auto" : "none";

  return (
    <View style={[styles.stage, { height }]} accessibilityRole="none">
      <Animated.View
        style={[styles.face, frontStyle]}
        pointerEvents={frontPointer}
        needsOffscreenAlphaCompositing
      >
        {front}
      </Animated.View>
      <Animated.View
        style={[styles.face, backStyle]}
        pointerEvents={backPointer}
        needsOffscreenAlphaCompositing
      >
        {back}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    position: "relative",
  },
  face: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
});

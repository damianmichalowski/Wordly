import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const SPRING = {
  damping: 17,
  stiffness: 128,
  mass: 0.75,
};

export type RevisionFlipDirection = 1 | -1;

type RevisionFlipCardProps = {
  cardKey: string;
  isFlipped: boolean;
  flipDirection: RevisionFlipDirection;
  height: number;
  front: ReactNode;
  back: ReactNode;
};

export function RevisionFlipCard({
  cardKey,
  isFlipped,
  flipDirection,
  height,
  front,
  back,
}: RevisionFlipCardProps) {
  const spin = useSharedValue(0);
  const prevFlippedRef = useRef(isFlipped);

  useLayoutEffect(() => {
    spin.value = 0;
    prevFlippedRef.current = false;
  }, [cardKey, spin]);

  useEffect(() => {
    if (prevFlippedRef.current === isFlipped) {
      return;
    }
    prevFlippedRef.current = isFlipped;
    spin.value = withSpring(spin.value + flipDirection * 180, SPRING);
  }, [isFlipped, flipDirection, spin]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${spin.value}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { rotateY: `${spin.value + 180}deg` },
    ],
  }));

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

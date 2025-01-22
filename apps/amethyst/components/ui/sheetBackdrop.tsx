import React, { useMemo } from "react";
import { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import Animated, {
  AnimatedStyle,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { StyleProp, ViewStyle } from "react-native";

export default function SheetBackdrop({
  animatedIndex,
  style,
}: BottomSheetBackdropProps) {
  console.log("animatedIndex", animatedIndex);
  // animated variables
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0, 1], // adjusted input range
      [0, 0.5, 0.8], // adjusted output range
      Extrapolation.CLAMP,
    ),
  }));

  // styles
  const containerStyle = useMemo(
    () => [
      style,
      {
        backgroundColor: "#000000",
        width: "100vw",
        position: "fixed",
      },
      containerAnimatedStyle,
    ],
    [style, containerAnimatedStyle],
  );

  return (
    <Animated.View
      style={containerStyle as StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>}
    />
  );
}

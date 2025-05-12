import React, { useMemo } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  AnimatedStyle,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

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

// background-bg sheet handle
export const SheetHandle = ({
  animatedIndex,
  style,
}: BottomSheetBackdropProps) => {
  return (
    <View className="h-6 w-full items-center rounded-t-xl border-x border-t border-neutral-500/30 bg-card">
      <View className="m-1 h-1.5 w-16 rounded-xl bg-muted-foreground/50 transition-colors hover:bg-muted-foreground/70" />
    </View>
  );
};

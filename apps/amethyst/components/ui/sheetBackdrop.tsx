import React, { useMemo } from "react";
import { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import Animated, {
  AnimatedStyle,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { StyleProp, View, ViewStyle } from "react-native";

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
    <View className="w-full items-center h-6 bg-background rounded-t-xl border-t border-x border-neutral-500/30">
      <View className="w-16 bg-muted-foreground/50 hover:bg-muted-foreground/70 transition-colors h-1.5 m-1 rounded-xl" />
    </View>
  );
};

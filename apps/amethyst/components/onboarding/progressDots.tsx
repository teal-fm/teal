import React from "react";
import { View } from "react-native";

interface ProgressDotsProps {
  totalSteps: number;
  currentStep: number;
}

const ProgressDots: React.FC<ProgressDotsProps> = ({
  totalSteps,
  currentStep,
}) => {
  const dots = [];

  for (let i = 1; i <= totalSteps; i++) {
    const isActive = i <= currentStep;
    dots.push(
      <View
        key={i}
        className={`m-2 h-4 w-4 rounded-full ${isActive ? `bg-accent` : `bg-muted`} `}
      />,
    );
  }

  return <View className="flex-row items-center justify-center">{dots}</View>;
};

export default ProgressDots;

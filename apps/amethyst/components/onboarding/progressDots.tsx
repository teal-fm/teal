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
        className={`mx-1.5 mt-5 h-1.5 rounded-full ${isActive ? `w-10 bg-primary` : `w-5 bg-muted`} `}
      />,
    );
  }

  return <View className="flex-row items-center justify-center">{dots}</View>;
};

export default ProgressDots;

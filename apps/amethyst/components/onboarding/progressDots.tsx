import React from 'react';
import { View } from 'react-native';

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
        className={`
          w-4
          h-4
          rounded-full
          m-2
          ${isActive ? `bg-accent` : `bg-muted`}
        `}
      />,
    );
  }

  return <View className="flex-row justify-center items-center">{dots}</View>;
};

export default ProgressDots;

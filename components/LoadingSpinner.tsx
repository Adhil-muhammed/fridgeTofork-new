import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-cyan-400"></div>
      <p className="mt-4 text-gray-300 text-lg font-medium">{message}</p>
    </div>
  );
};

export default LoadingSpinner;
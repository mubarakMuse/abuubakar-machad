import React from 'react';

export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`loading-spinner ${sizeClasses[size]} ${className}`}></div>
  );
};

export const LoadingDots = ({ className = '' }) => {
  return (
    <div className={`loading-dots ${className}`}>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
};

export const LoadingPage = ({ message = 'Loading...', subMessage = '' }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <LoadingSpinner size="xl" />
        <div className="text-center">
          <p className="text-primary-600 font-semibold text-lg">{message}</p>
          {subMessage && <p className="text-neutral-500 text-sm mt-1">{subMessage}</p>}
        </div>
      </div>
    </div>
  );
};

export const LoadingCard = ({ message = 'Loading...' }) => {
  return (
    <div className="card p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-neutral-600">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;

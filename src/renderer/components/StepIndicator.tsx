import React from 'react';

interface Step {
  label: string;
  icon: string;
}

interface StepIndicatorProps {
  steps: Step[];
  current: number;
  onStepClick?: (step: number) => void;
}

export default function StepIndicator({ steps, current, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const isCompleted = i < current;
        const isCurrent = i === current;
        const isClickable = onStepClick && (i <= current);
        return (
          <React.Fragment key={i}>
            <button
              onClick={() => isClickable && onStepClick(i)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1.5 min-w-0 flex-shrink-0 transition-all duration-200 ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-primary text-on-primary shadow-sm'
                    : isCurrent
                      ? 'bg-primary-fixed text-on-primary-fixed ring-2 ring-primary ring-offset-2'
                      : 'bg-surface-container-high text-outline'
                }`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-lg">check</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">{step.icon}</span>
                )}
              </div>
              <span
                className={`text-xs font-semibold truncate max-w-[80px] ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-on-surface' : 'text-outline'
                }`}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors duration-200 ${
                  i < current ? 'bg-primary' : 'bg-surface-container-high'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

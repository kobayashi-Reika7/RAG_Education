import React from 'react';

// 表示順は [1 ログイン] → [2 診療予約] → [3 確認]。id は論理ステップ（currentStep と一致）
const steps = [
  { id: 2, displayNum: 1, label: 'ログイン' },
  { id: 1, displayNum: 2, label: '診療予約' },
  { id: 3, displayNum: 3, label: '予約内容確認' },
];

export default function ReservationStepHeader({ currentStep = 1 }) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <header className="step-header">
      <div className="stepper">
        <div className="stepper-line stepper-line-1" aria-hidden />
        <div className="stepper-line stepper-line-2" aria-hidden />

        <ol className="stepper-list" aria-label="予約の手順">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = currentIndex !== -1 && index < currentIndex;
            const stateClass = isActive
              ? 'stepper-dot-active'
              : isCompleted
              ? 'stepper-dot-completed'
              : 'stepper-dot-upcoming';

            return (
              <li
                key={step.id}
                className="stepper-item"
                aria-current={isActive ? 'step' : undefined}
              >
                <div className={`stepper-dot ${stateClass}`}>{step.displayNum}</div>
                <span className={`stepper-label ${isActive ? 'stepper-label-active' : ''}`}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </header>
  );
}


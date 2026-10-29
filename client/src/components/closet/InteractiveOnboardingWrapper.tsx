import { useEffect, useState, type ReactNode } from 'react';
import './InteractiveOnboardingWrapper.css';

const STORAGE_KEY = '@has_completed_closet_tour';

const TUTORIAL_STEPS = [
  {
    id: 'step_carousel',
    text: 'Swipe left or right on these arrows to cycle through your closet categories individually!',
    boxClass: 'is-carousel',
    arrowClass: 'arrow-top-center',
  },
  {
    id: 'step_shuffle',
    text: 'Feeling stuck? Click the SHUFFLE button on the left to let our AI randomly spin an experimental outfit matching your age profile!',
    boxClass: 'is-shuffle',
    arrowClass: 'arrow-bottom-left',
  },
  {
    id: 'step_tryon',
    text: 'Once you are ready or want to lock down a look, tap TRY ON to run our visual e-commerce match engine!',
    boxClass: 'is-tryon',
    arrowClass: 'arrow-bottom-right',
  },
] as const;

export default function InteractiveOnboardingWrapper({
  children,
  onTourComplete,
}: {
  children: ReactNode;
  onTourComplete?: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'true') setIsVisible(true);
    } catch {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
    onTourComplete?.();
  };

  const activeStep = TUTORIAL_STEPS[currentStep];

  return (
    <div className="closet-tour-root">
      {children}
      {isVisible && activeStep && (
        <>
          <div className="closet-tour-dim" aria-hidden />
          <div
            className={`closet-tour-tooltip ${activeStep.boxClass}`}
            role="dialog"
            aria-labelledby="closet-tour-step"
            aria-describedby="closet-tour-copy"
          >
            <span className={`closet-tour-caret ${activeStep.arrowClass}`} aria-hidden />
            <p className="closet-tour-counter" id="closet-tour-step">
              STEP {currentStep + 1} OF {TUTORIAL_STEPS.length}
            </p>
            <p className="closet-tour-copy" id="closet-tour-copy">
              {activeStep.text}
            </p>
            <button type="button" className="closet-tour-next" onClick={handleNext}>
              {currentStep === TUTORIAL_STEPS.length - 1 ? "GOT IT, LET'S DRESS! 🎉" : 'NEXT GUIDANCE ➔'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AsyncStorage } from '../../lib/asyncStorage';
import './InteractiveOnboardingWrapper.css';

/** Matches the RN tour keys so first-time installs only see this once. */
export const CLOSET_TOUR_COMPLETED_KEY = '@has_completed_closet_tour';
export const CLOSET_FIRST_INSTALL_KEY = '@closet_first_install';

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
  workspaceSelector = '.clueless-workspace',
}: {
  children: ReactNode;
  onTourComplete?: () => void;
  /** Tour only while this workspace node is mounted (closet mixer). */
  workspaceSelector?: string;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncTour = async () => {
      const completed = await AsyncStorage.getItem(CLOSET_TOUR_COMPLETED_KEY);
      if (completed === 'true') {
        if (!cancelled) setIsVisible(false);
        return;
      }
      const installed = await AsyncStorage.getItem(CLOSET_FIRST_INSTALL_KEY);
      if (!installed) {
        await AsyncStorage.setItem(CLOSET_FIRST_INSTALL_KEY, String(Date.now()));
      }
      const workspaceReady =
        typeof document === 'undefined' || !workspaceSelector
          ? true
          : Boolean(document.querySelector(workspaceSelector));
      if (!cancelled) setIsVisible(workspaceReady);
    };

    void syncTour();
    const root = typeof document !== 'undefined' ? document.body : null;
    if (!root || typeof MutationObserver === 'undefined') {
      return () => {
        cancelled = true;
      };
    }
    const observer = new MutationObserver(() => {
      void syncTour();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [workspaceSelector]);

  const handleNext = async () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
    setIsVisible(false);
    await AsyncStorage.setItem(CLOSET_TOUR_COMPLETED_KEY, 'true');
    onTourComplete?.();
  };

  const activeStep = TUTORIAL_STEPS[currentStep];
  const host =
    typeof document !== 'undefined'
      ? document.querySelector('.clueless-root') || document.querySelector('.closet-stack')
      : null;

  const overlay =
    isVisible && activeStep ? (
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
          <button type="button" className="closet-tour-next" onClick={() => void handleNext()}>
            {currentStep === TUTORIAL_STEPS.length - 1 ? "GOT IT, LET'S DRESS! 🎉" : 'NEXT GUIDANCE ➔'}
          </button>
        </div>
      </>
    ) : null;

  return (
    <div className="closet-tour-root">
      {children}
      {overlay && host ? createPortal(overlay, host) : overlay}
    </div>
  );
}

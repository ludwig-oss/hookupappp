import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AsyncStorage } from '../../lib/asyncStorage';
import './InteractiveOnboardingWrapper.css';

export const CLOSET_TOUR_COMPLETED_KEY = '@has_completed_closet_tour';
export const CLOSET_FIRST_INSTALL_KEY = '@closet_first_install';

type StepId = 'step_carousel' | 'step_shuffle' | 'step_tryon';
type PointerSide = 'up' | 'left' | 'right';

const TUTORIAL_STEPS: Array<{
  id: StepId;
  target: 'carousel' | 'shuffle' | 'tryon';
  pointer: PointerSide;
  text: string;
}> = [
  {
    id: 'step_carousel',
    target: 'carousel',
    pointer: 'up',
    text: 'Swipe left or right on these arrows to cycle through your closet categories individually!',
  },
  {
    id: 'step_shuffle',
    target: 'shuffle',
    pointer: 'left',
    text: 'Feeling stuck? Click the SHUFFLE button on the left to let our AI randomly spin an experimental outfit matching your age profile!',
  },
  {
    id: 'step_tryon',
    target: 'tryon',
    pointer: 'right',
    text: 'Once you are ready or want to lock down a look, tap TRY ON to run our visual e-commerce match engine!',
  },
];

function tooltipStyleFor(
  target: HTMLElement,
  host: HTMLElement,
  pointer: PointerSide
): CSSProperties {
  const t = target.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  const gap = 14;
  const width = Math.min(280, h.width - 24);

  if (pointer === 'left') {
    return {
      top: t.top - h.top + t.height / 2,
      left: t.right - h.left + gap,
      transform: 'translateY(-50%)',
      width,
    };
  }
  if (pointer === 'right') {
    return {
      top: t.top - h.top + t.height / 2,
      left: t.left - h.left - gap - width,
      transform: 'translateY(-50%)',
      width,
    };
  }
  return {
    top: t.bottom - h.top + gap,
    left: t.left - h.left + t.width / 2,
    transform: 'translateX(-50%)',
    width,
  };
}

export default function InteractiveOnboardingWrapper({
  children,
  onTourComplete,
  workspaceSelector = '.clueless-workspace',
}: {
  children: ReactNode;
  onTourComplete?: () => void;
  workspaceSelector?: string;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [boxStyle, setBoxStyle] = useState<CSSProperties>({});

  const activeStep = TUTORIAL_STEPS[currentStep];

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

  useEffect(() => {
    if (!isVisible || !activeStep) return;
    const host = document.querySelector('.clueless-root') as HTMLElement | null;
    const target = document.querySelector(`[data-closet-tour="${activeStep.target}"]`) as HTMLElement | null;
    document.querySelectorAll('[data-closet-tour]').forEach((el) => {
      el.classList.toggle('is-tour-hot', el.getAttribute('data-closet-tour') === activeStep.target);
    });
    if (host && target) setBoxStyle(tooltipStyleFor(target, host, activeStep.pointer));

    const onWin = () => {
      if (host && target) setBoxStyle(tooltipStyleFor(target, host, activeStep.pointer));
    };
    window.addEventListener('resize', onWin);
    return () => {
      window.removeEventListener('resize', onWin);
      document.querySelectorAll('[data-closet-tour]').forEach((el) => el.classList.remove('is-tour-hot'));
    };
  }, [isVisible, activeStep]);

  const handleNext = async () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
    setIsVisible(false);
    await AsyncStorage.setItem(CLOSET_TOUR_COMPLETED_KEY, 'true');
    onTourComplete?.();
  };

  const host =
    typeof document !== 'undefined'
      ? document.querySelector('.clueless-root') || document.querySelector('.closet-stack')
      : null;

  const overlay =
    isVisible && activeStep ? (
      <>
        <div className="closet-tour-dim" aria-hidden />
        <div
          className={`closet-tour-tooltip points-${activeStep.pointer}`}
          style={boxStyle}
          role="dialog"
          aria-labelledby="closet-tour-step"
          aria-describedby="closet-tour-copy"
        >
          <span className={`closet-tour-pointer points-${activeStep.pointer}`} aria-hidden />
          <p className="closet-tour-kicker">CONFIG</p>
          <p className="closet-tour-counter" id="closet-tour-step">
            STEP {String(currentStep + 1).padStart(2, '0')} / {String(TUTORIAL_STEPS.length).padStart(2, '0')}
          </p>
          <p className="closet-tour-copy" id="closet-tour-copy">
            {activeStep.text}
          </p>
          <button type="button" className="closet-tour-next" onClick={() => void handleNext()}>
            {currentStep === TUTORIAL_STEPS.length - 1 ? "GOT IT, LET'S DRESS" : 'NEXT'}
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

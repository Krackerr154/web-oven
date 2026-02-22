"use client";

import { useState, useEffect } from "react";
import { markTourCompleted } from "@/app/actions/onboarding";
import { X, ChevronRight, Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

interface SpotlightTourProps {
  hasSeenTour: boolean;
}

export function SpotlightTour({ hasSeenTour }: SpotlightTourProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hasSeenTour) {
      sessionStorage.setItem("tourActive", "true");
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour]);

  const steps = [
    {
      title: "Welcome to Lab Oven Booking!",
      description:
        "Let's take a quick 4-step tour to help you get started with reserving the laboratory ovens.",
    },
    {
      title: "Real-time Oven Status",
      description:
        "Here you can see exactly which ovens are Available, In Use, or under Maintenance so you know what's open.",
      targetId: "tour-ovens",
    },
    {
      title: "Booking Calendar",
      description:
        "Scroll down to the calendar to see all active and upcoming reservations at a glance to plan your slots.",
      targetId: "tour-calendar",
    },
    {
      title: "Make a Booking",
      description:
        "Click here anytime to request a block of time. Make sure you know your usage temperatures and flap configurations.",
      targetId: "tour-book",
    },
    {
      title: "Review the Rules",
      description:
        "Whenever you book, please ensure you review the Usage Guidelines. This button is always available at the top of the Booking page.",
      targetId: "tour-guidelines",
      route: "/book",
    },
    {
      title: "Complete Your Profile",
      description:
        "Finally, click on the Profile tab to set up an avatar and nickname so others can easily identify your bookings.",
      targetId: "tour-profile",
      route: "/profile",
    },
  ];

  useEffect(() => {
    if (!isVisible) return;

    const calculatePosition = () => {
      const step = steps[activeStep];
      if (step.targetId) {
        const el = document.getElementById(step.targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);

          const isMobilePopover = window.innerWidth < 640;
          if (isMobilePopover) {
            // On mobile, dock to bottom to save screen real estate
            setPopoverStyle({
              position: "fixed",
              bottom: "20px",
              left: "20px",
              right: "20px",
              width: "auto",
            });
          } else {
            // On desktop, try to place it intelligently below the target
            let top = rect.bottom + 20;
            let left = rect.left;

            if (left + 320 > window.innerWidth) {
              left = window.innerWidth - 340; // constrain horizontally
            }
            if (top + 200 > window.innerHeight) {
              top = rect.top - 200 - 20; // push above if bottom bounds exceeded
            }
            if (top < 20) top = 20;

            setPopoverStyle({
              position: "fixed",
              top: `${top}px`,
              left: `${left}px`,
              width: "320px",
            });
          }
        } else {
          setTargetRect(null);
          centerPopover();
        }
      } else {
        setTargetRect(null);
        centerPopover();
      }
    };

    const centerPopover = () => {
      setPopoverStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "320px",
      });
    };

    const setupStep = () => {
      const step = steps[activeStep];

      // Handle mobile sidebar logic (Tailwind 'lg' is 1024px)
      if (window.innerWidth < 1024) {
        if (step.targetId === "tour-book" || step.targetId === "tour-profile") {
          window.dispatchEvent(new Event("open-mobile-sidebar"));
        } else {
          window.dispatchEvent(new Event("close-mobile-sidebar"));
        }
      }

      if (step.targetId) {
        // We wait a tiny bit for the sidebar transition to start/finish before parsing the element
        setTimeout(() => {
          const el = document.getElementById(step.targetId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(calculatePosition, 400); // 400ms to allow smooth scroll and sidebar slide to finish
          } else {
            calculatePosition();
          }
        }, 50);
      } else {
        calculatePosition();
      }
    };

    setupStep();

    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, { passive: true });
    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition);
    };
  }, [activeStep, isVisible]);

  if (!isVisible) return null;

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      const nextStepObj = steps[activeStep + 1];
      if (nextStepObj.route && pathname !== nextStepObj.route) {
        // Pre-navigate the user before updating step, adding a slight delay so DOM mounts
        router.push(nextStepObj.route);
        setTimeout(() => setActiveStep((prev) => prev + 1), 600);
      } else {
        setActiveStep((prev) => prev + 1);
      }
    } else {
      finishTour();
    }
  };

  const finishTour = async () => {
    setIsVisible(false);
    sessionStorage.removeItem("tourActive");
    await markTourCompleted();
    router.refresh();
  };

  const currentStep = steps[activeStep];

  return (
    <>
      {/* Background Mask Layer */}
      <div
        className="fixed inset-0 z-[90] pointer-events-auto transition-all duration-300"
        style={{
          backgroundColor: targetRect ? "transparent" : "rgba(2, 6, 23, 0.6)",
          backdropFilter: targetRect ? "none" : "blur(4px)",
        }}
      >
        {/* 
                    We use a massive box-shadow to achieve the "cutout" Spotlight effect natively
                    without complex SVG masking clipping paths. 
                */}
        {targetRect && currentStep.targetId && (
          <div
            className="fixed transition-all duration-500 ease-in-out border-2 border-orange-500 rounded-xl pointer-events-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.75)", // Dimming surround
            }}
          />
        )}
      </div>

      {/* Spotlight Popover Box */}
      <div
        className="z-[100] bg-slate-800 border-2 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.3)] rounded-2xl p-5 animate-toast-in transition-all duration-500"
        style={popoverStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold shrink-0">
              {activeStep + 1}
            </span>
            <h3 className="font-semibold text-white leading-tight">
              {currentStep.title}
            </h3>
          </div>
          <button
            onClick={finishTour}
            className="text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
            title="Skip Tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-5 leading-relaxed">
          {currentStep.description}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === activeStep ? "w-4 bg-orange-500" : "w-1.5 bg-slate-600"}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors shadow-[0_0_15px_rgba(234,88,12,0.4)]"
          >
            {activeStep === steps.length - 1 ? (
              <>
                Finish <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Next <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

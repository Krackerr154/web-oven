"use client";

import { useState, useEffect } from "react";
import { markTourCompleted } from "@/app/actions/onboarding";
import { X, ChevronRight, Check, LayoutDashboard, Flame, Waves, Box } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

interface SpotlightTourProps {
  hasSeenTour: boolean;
}

type TourSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
};

type TourStep = {
  title: string;
  description: string;
  targetId?: string;
  route?: string;
  section: string; // matches TourSection.id
};

const SECTIONS: TourSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "text-blue-400",
    borderColor: "border-blue-500",
    bgColor: "bg-blue-500/20",
  },
  {
    id: "oven",
    label: "Oven",
    icon: Flame,
    color: "text-orange-400",
    borderColor: "border-orange-500",
    bgColor: "bg-orange-500/20",
  },
  {
    id: "ultrasonic",
    label: "Ultrasonic Bath",
    icon: Waves,
    color: "text-cyan-400",
    borderColor: "border-cyan-500",
    bgColor: "bg-cyan-500/20",
  },
  {
    id: "glovebox",
    label: "Glovebox",
    icon: Box,
    color: "text-purple-400",
    borderColor: "border-purple-500",
    bgColor: "bg-purple-500/20",
  },
];

const STEPS: TourStep[] = [
  // ── Part 1: Dashboard ──────────────────────────────────────────────────
  {
    section: "dashboard",
    title: "Welcome to AP-Lab Dashboard!",
    description:
      "This is your central hub for managing lab instruments, tracking bookings, and searching the reagent inventory. Let's take a quick tour!",
    route: "/",
  },
  {
    section: "dashboard",
    title: "Instruments Quick-Access",
    description:
      "Click here to view and book any of the three lab instruments: the Oven, Ultrasonic Bath, or Glovebox.",
    targetId: "tour-instruments-card",
    route: "/",
  },
  {
    section: "dashboard",
    title: "Reagents Inventory",
    description:
      "Search the lab chemical inventory here to check stock availability before you start your experiments.",
    targetId: "tour-reagents-card",
    route: "/",
  },
  {
    section: "dashboard",
    title: "Your Active Bookings",
    description:
      "Your ongoing and upcoming instrument bookings are listed here so you always have a quick overview of your scheduled sessions.",
    targetId: "tour-active-bookings",
    route: "/",
  },

  // ── Part 2: Oven ───────────────────────────────────────────────────────
  {
    section: "oven",
    title: "Drying Ovens",
    description:
      "The high-temperature ovens support sample drying, curing, and thermal treatment. Units are available in Aqueous and Non-Aqueous modes.",
    targetId: "tour-oven-card",
    route: "/instruments",
  },
  {
    section: "oven",
    title: "Booking the Oven",
    description:
      "Click 'Book Instrument' on the Oven card to schedule a time slot. You'll be asked for your usage temperature, flap setting, and purpose.",
    targetId: "tour-book",
  },
  {
    section: "oven",
    title: "Oven Usage Guidelines",
    description:
      "Always check the Usage Guidelines before booking. Fill out both this digital form and the physical logbook next to the oven.",
    targetId: "tour-guidelines",
    route: "/book",
  },

  // ── Part 3: Ultrasonic Bath ────────────────────────────────────────────
  {
    section: "ultrasonic",
    title: "Ultrasonic Bath",
    description:
      "The ultrasonic bath uses high-frequency sonication to clean glassware, dissolve samples, and degas liquids. Integration coming soon!",
    targetId: "tour-ultrasonic-card",
    route: "/instruments",
  },

  // ── Part 4: Glovebox ──────────────────────────────────────────────────
  {
    section: "glovebox",
    title: "Glovebox",
    description:
      "The glovebox provides an inert (Argon-purged) atmosphere for handling air and moisture-sensitive materials. Integration coming soon!",
    targetId: "tour-glovebox-card",
    route: "/instruments",
  },
  {
    section: "glovebox",
    title: "Complete Your Profile",
    description:
      "Finally, set up your profile with an avatar and nickname so others can recognize your bookings in the calendar.",
    targetId: "tour-profile",
    route: "/profile",
  },
];

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

  const currentStep = STEPS[activeStep];
  const currentSection = SECTIONS.find((s) => s.id === currentStep.section)!;

  useEffect(() => {
    if (!isVisible) return;

    const calculatePosition = () => {
      if (currentStep.targetId) {
        const el = document.getElementById(currentStep.targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);

          const isMobile = window.innerWidth < 640;
          if (isMobile) {
            setPopoverStyle({
              position: "fixed",
              bottom: "20px",
              left: "20px",
              right: "20px",
              width: "auto",
            });
          } else {
            let top = rect.bottom + 20;
            let left = rect.left;

            if (left + 340 > window.innerWidth) left = window.innerWidth - 360;
            if (top + 220 > window.innerHeight) top = rect.top - 220 - 20;
            if (top < 20) top = 20;

            setPopoverStyle({
              position: "fixed",
              top: `${top}px`,
              left: `${left}px`,
              width: "340px",
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
        width: "340px",
      });
    };

    const setupStep = () => {
      // Handle mobile sidebar
      if (window.innerWidth < 1024) {
        if (currentStep.targetId === "tour-book" || currentStep.targetId === "tour-profile") {
          window.dispatchEvent(new Event("open-mobile-sidebar"));
        } else {
          window.dispatchEvent(new Event("close-mobile-sidebar"));
        }
      }

      if (currentStep.targetId) {
        setTimeout(() => {
          const el = document.getElementById(currentStep.targetId!);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(calculatePosition, 400);
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
    if (activeStep < STEPS.length - 1) {
      const next = STEPS[activeStep + 1];
      if (next.route && pathname !== next.route) {
        router.push(next.route);
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

  // Group steps by section for the section progress dots
  const sectionSteps = SECTIONS.map((sec) => ({
    ...sec,
    steps: STEPS.filter((s) => s.section === sec.id),
    firstIndex: STEPS.findIndex((s) => s.section === sec.id),
  }));

  const isLastStep = activeStep === STEPS.length - 1;

  return (
    <>
      {/* Overlay mask */}
      <div
        className="fixed inset-0 z-[90] pointer-events-auto transition-all duration-300"
        style={{
          backgroundColor: targetRect ? "transparent" : "rgba(2, 6, 23, 0.6)",
          backdropFilter: targetRect ? "none" : "blur(4px)",
        }}
      >
        {targetRect && currentStep.targetId && (
          <div
            className={`fixed transition-all duration-500 ease-in-out border-2 ${currentSection.borderColor} rounded-xl pointer-events-none`}
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.75)",
            }}
          />
        )}
      </div>

      {/* Popover */}
      <div
        className={`z-[100] bg-slate-900 border-2 ${currentSection.borderColor}/50 shadow-2xl rounded-2xl overflow-hidden animate-toast-in transition-all duration-500`}
        style={popoverStyle}
      >
        {/* Section tabs header */}
        <div className="flex border-b border-slate-700/60">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = sec.id === currentStep.section;
            return (
              <div
                key={sec.id}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${isActive
                  ? `${sec.bgColor} ${sec.color} border-b-2 ${sec.borderColor}`
                  : "text-slate-500"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:block">{sec.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`flex items-center justify-center w-6 h-6 rounded-full ${currentSection.bgColor} ${currentSection.color} text-xs font-bold shrink-0`}>
                {activeStep + 1}
              </span>
              <h3 className="font-semibold text-white leading-tight text-sm">
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

          {/* Progress: section-based dots */}
          <div className="flex items-center gap-3 mb-4">
            {sectionSteps.map((sec) => {
              const isActiveSec = sec.id === currentStep.section;
              const isPastSec = sec.firstIndex < STEPS.findIndex((s) => s.section === currentStep.section);
              const stepsInSec = sec.steps.length;
              const activeInSec = isActiveSec
                ? STEPS.slice(sec.firstIndex).findIndex((_, i) => sec.firstIndex + i === activeStep) + 1
                : isPastSec ? stepsInSec : 0;

              return (
                <div key={sec.id} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5">
                    {sec.steps.map((_, i) => {
                      const isFilled = isPastSec || (isActiveSec && i < activeInSec);
                      return (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${isFilled ? sec.bgColor.replace("/20", "") : "bg-slate-700"}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Step {activeStep + 1} of {STEPS.length}
            </span>
            <button
              onClick={handleNext}
              className={`flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${isLastStep
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : `bg-slate-700 hover:bg-slate-600`
                }`}
            >
              {isLastStep ? (
                <>Finish <Check className="h-4 w-4" /></>
              ) : (
                <>Next <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

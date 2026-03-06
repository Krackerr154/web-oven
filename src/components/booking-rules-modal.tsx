"use client";

import { useState, useEffect, ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/dialog";
import { BookOpen, CheckCircle2, ShieldAlert, Clock, AlertTriangle, FileText, Waves, Droplets, Thermometer, Snowflake } from "lucide-react";

// ─── Oven Guidelines ─────────────────────────────────────────────────────────

function OvenRules() {
    return (
        <div className="space-y-4 py-4">
            <RuleRow icon={<FileText className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">1. Form &amp; Physical Logbook</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Please fill out <strong>both</strong> this digital booking form and the physical logbook located next to the instrument. Do not skip either.
                </p>
            </RuleRow>

            <RuleRow icon={<ShieldAlert className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">2. One Active Booking Limit</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Maximum booking per person is <strong>1 instrument</strong> at a time. You cannot book another time slot or another instrument until your ongoing usage is completed.
                </p>
            </RuleRow>

            <RuleRow icon={<Clock className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">3. Strict Time Etiquette</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Booking time must match actual usage time. If you exceed your booked duration, the next user has the right to remove your sample. Please be considerate as the instrument is a shared resource.
                </p>
            </RuleRow>

            <RuleRow icon={<AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">4. Cancellations &amp; Revisions</h4>
                <p className="text-sm text-slate-400 mt-1">
                    You have a 1-hour grace period to Edit or Cancel your booking natively. Late cancellations will require you to send an automated WhatsApp message to the Admin grouping.
                </p>
            </RuleRow>
        </div>
    );
}

// ─── Ultrasonic Bath Guidelines ───────────────────────────────────────────────

function UltrasonicRules() {
    return (
        <div className="space-y-4 py-4">
            <RuleRow icon={<FileText className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">1. Digital Logbook Only</h4>
                <p className="text-sm text-slate-400 mt-1">
                    The Sonicator Branson uses a <strong>digital-only</strong> logbook. Fill out this form completely — no physical logbook is required, but the booking must be submitted before you start.
                </p>
            </RuleRow>

            <RuleRow icon={<ShieldAlert className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">2. One Active Booking Limit</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Maximum booking per person is <strong>1 instrument</strong> at a time. You cannot book the ultrasonic bath while you have another active booking.
                </p>
            </RuleRow>

            <RuleRow icon={<Waves className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">3. Same-Day Usage Only</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Bookings are limited to <strong>one calendar day</strong>. Both start and end times must fall on the same date. Plan your sonication, heating, or degassing within a single day session.
                </p>
            </RuleRow>

            <RuleRow icon={<Thermometer className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">4. Temperature Limit (Heat Mode)</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Maximum bath temperature is <strong>60°C</strong>. If the Heated Bath mode is not selected, the bath will operate at room temperature (~25°C) by default. Never exceed 60°C.
                </p>
            </RuleRow>

            <RuleRow icon={<Droplets className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">5. Post-Use Responsibility</h4>
                <p className="text-sm text-slate-400 mt-1">
                    After each session you must: <strong>drain</strong> the water basin completely, press the <strong>Off</strong> button on the back of the unit, and <strong>unplug</strong> the power cable. Failure to do so affects the next user.
                </p>
            </RuleRow>

            <RuleRow icon={<AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">6. Cancellations &amp; Revisions</h4>
                <p className="text-sm text-slate-400 mt-1">
                    You have a 1-hour grace period to Edit or Cancel your booking natively. Late cancellations will require you to send an automated WhatsApp message to the Admin grouping.
                </p>
            </RuleRow>
        </div>
    );
}

// ─── Glovebox Guidelines ────────────────────────────────────────────────────

function GloveboxRules() {
    return (
        <div className="space-y-4 py-4">
            <RuleRow icon={<FileText className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">1. Digital Logbook Only</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Please fill out this online logbook form when using the glovebox. There is no physical logbook. Bookings must be submitted before usage.
                </p>
            </RuleRow>

            <RuleRow icon={<ShieldAlert className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">2. One Active Booking Limit &amp; Same-Day</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Maximum booking per person is <strong>1 instrument</strong> at a time. Bookings are limited to <strong>one calendar day</strong> to ensure fair sharing.
                </p>
            </RuleRow>

            <RuleRow icon={<Droplets className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">3. Cleanliness is Mandatory</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Please always keep the workspace inside the glovebox clean. Do <strong>not</strong> leave glassware, spatulas, tissues, samples, or trash inside.
                </p>
            </RuleRow>

            <RuleRow icon={<AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">4. No Storage Allowed</h4>
                <p className="text-sm text-slate-400 mt-1">
                    <strong>Do not</strong> store any solutions or solvents inside the glovebox. Do not use the glovebox for storage.
                </p>
            </RuleRow>

            <RuleRow icon={<Waves className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">5. Turn Off Nitrogen</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Do not forget to <strong>shut off the nitrogen gas supply</strong> after you are done. Logging your flow rate and duration is also required.
                </p>
            </RuleRow>

            <RuleRow icon={<AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">6. Cancellations &amp; Revisions</h4>
                <p className="text-sm text-slate-400 mt-1">
                    You have a 1-hour grace period to Edit or Cancel your booking natively. Late cancellations require Admin contact.
                </p>
            </RuleRow>
        </div>
    );
}

// ─── CPD Tousimis Guidelines ────────────────────────────────────────────────

function CpdRules() {
    return (
        <div className="space-y-4 py-4">
            <RuleRow icon={<FileText className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">1. Form & Physical Logbook</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Please fill out <strong>both</strong> this digital booking form and the physical logbook located next to the instrument. Do not skip either.
                </p>
            </RuleRow>

            <RuleRow icon={<ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">2. Acid-Free Samples Only</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Ensure your sample has been thoroughly washed and dried, completely <strong>free of any acid compounds</strong> (HF, HCl, H₂SO₄, HCOOH, CH₃COOH, etc.) before loading into the CPD.
                </p>
            </RuleRow>

            <RuleRow icon={<Clock className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">3. Booking Schedule</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Booking must be made <strong>at least one week</strong> before usage. Approval is processed weekly, every <strong>Friday at 10:30 WIB</strong>. Disapproved bookings should be discussed with the admin.
                </p>
            </RuleRow>

            <RuleRow icon={<Snowflake className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">4. Post-Use Checklist</h4>
                <p className="text-sm text-slate-400 mt-1">
                    After usage, you must ensure: the <strong>chamber is clean and dry</strong>, the <strong>LCO₂ cylinder valve is closed</strong>, and the <strong>sample holder is cleaned with ethanol</strong> before returning.
                </p>
            </RuleRow>

            <RuleRow icon={<AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">5. Cancellations</h4>
                <p className="text-sm text-slate-400 mt-1">
                    If cancelling, send a message to the <strong>CPD Active Users</strong> group with format: <code className="text-purple-300 text-xs bg-slate-800 px-1 py-0.5 rounded">#cpd #cancelbooking [Name] cancels CPD on [start] to [end]</code>.
                </p>
            </RuleRow>

            <RuleRow icon={<AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}>
                <h4 className="font-medium text-slate-200 text-sm">6. Misuse Policy</h4>
                <p className="text-sm text-slate-400 mt-1">
                    Any misuse of the CPD or violation of the booking system will be recorded and may affect future booking approvals.
                </p>
            </RuleRow>
        </div>
    );
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function RuleRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
            {icon}
            <div>{children}</div>
        </div>
    );
}

// ─── Modal component ─────────────────────────────────────────────────────────

type Variant = "oven" | "ultrasonic" | "glovebox" | "cpd";

const SESSION_KEY: Record<Variant, string> = {
    oven: "hideBookingRules",
    ultrasonic: "hideUltrasonicRules",
    glovebox: "hideGloveboxRules",
    cpd: "hideCpdRules",
};

export function BookingRulesModal({ id, variant = "oven" }: { id?: string; variant?: Variant }) {
    const [open, setOpen] = useState(false);
    const [hideThisSession, setHideThisSession] = useState(false);

    useEffect(() => {
        const isHiddenThisSession = sessionStorage.getItem(SESSION_KEY[variant]) === "true";
        const isTourActive = sessionStorage.getItem("tourActive") === "true";

        if (!isHiddenThisSession && !isTourActive) {
            setOpen(true);
        }
    }, [variant]);

    const handleClose = () => {
        if (hideThisSession) {
            sessionStorage.setItem(SESSION_KEY[variant], "true");
        }
        setOpen(false);
    };

    const accentColor = variant === "ultrasonic" ? "text-cyan-400" : variant === "glovebox" ? "text-emerald-400" : variant === "cpd" ? "text-purple-400" : "text-blue-500";
    const btnColor = variant === "ultrasonic"
        ? "bg-cyan-600 hover:bg-cyan-500"
        : variant === "glovebox"
            ? "bg-emerald-600 hover:bg-emerald-500"
            : variant === "cpd"
                ? "bg-purple-600 hover:bg-purple-500"
                : "bg-blue-600 hover:bg-blue-500";

    return (
        <>
            <button
                id={id}
                onClick={() => setOpen(true)}
                type="button"
                className={`text-sm flex items-center gap-2 px-3 py-2 ${variant === "ultrasonic"
                    ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20"
                    : variant === "glovebox"
                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                        : variant === "cpd"
                            ? "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20"
                            : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20"
                    } rounded-lg transition-colors shrink-0`}
            >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Usage Guidelines</span>
                <span className="sm:hidden">Rules</span>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className={`flex items-center gap-2 text-xl`}>
                            <BookOpen className={`h-5 w-5 ${accentColor}`} />
                            {variant === "ultrasonic" ? "Ultrasonic Bath Guidelines" : variant === "glovebox" ? "Glovebox Usage Guidelines" : variant === "cpd" ? "CPD Tousimis Guidelines" : "Instrument Usage Guidelines"}
                        </DialogTitle>
                        <DialogDescription>
                            {variant === "ultrasonic"
                                ? "Please review the following rules before booking the Sonicator Branson. These guidelines ensure safe and fair usage for everyone."
                                : variant === "glovebox"
                                    ? "Please review the strict rules for using the Acrylic Glovebox. Safety and cleanliness are mandatory."
                                    : variant === "cpd"
                                        ? "Please review the CPD Tousimis usage rules. Ensure your samples are acid-free and follow the booking timeline."
                                        : "Please review the following rules before proceeding with your booking. These guidelines ensure fair and safe usage for everyone."}
                        </DialogDescription>
                    </DialogHeader>

                    {variant === "ultrasonic" ? <UltrasonicRules /> : variant === "glovebox" ? <GloveboxRules /> : variant === "cpd" ? <CpdRules /> : <OvenRules />}

                    <DialogFooter className="sm:justify-between items-center flex-col sm:flex-row gap-4 sm:gap-0 mt-4">
                        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none self-start sm:self-center">
                            <input
                                type="checkbox"
                                checked={hideThisSession}
                                onChange={(e) => setHideThisSession(e.target.checked)}
                                className="rounded border-slate-700 bg-slate-900/50 text-blue-500 focus:ring-blue-500/50 w-4 h-4 cursor-pointer"
                            />
                            Don&apos;t show again this session
                        </label>
                        <button
                            onClick={handleClose}
                            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 ${btnColor} text-white font-medium rounded-lg transition-colors`}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            I Understand
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/dialog";
import { BookOpen, CheckCircle2, ShieldAlert, Clock, AlertTriangle, FileText } from "lucide-react";

export function BookingRulesModal({ id }: { id?: string }) {
    const [open, setOpen] = useState(false);

    const [hideThisSession, setHideThisSession] = useState(false);

    useEffect(() => {
        // Check if the user has disabled the rules for this session, or if the onboarding tour is actively running
        const isHiddenThisSession = sessionStorage.getItem("hideBookingRules") === "true";
        const isTourActive = sessionStorage.getItem("tourActive") === "true";

        if (!isHiddenThisSession && !isTourActive) {
            setOpen(true);
        }
    }, []);

    const handleClose = () => {
        if (hideThisSession) {
            sessionStorage.setItem("hideBookingRules", "true");
        }
        setOpen(false);
    };

    return (
        <>
            <button
                id={id}
                onClick={() => setOpen(true)}
                type="button"
                className="text-sm flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors shrink-0"
            >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Usage Guidelines</span>
                <span className="sm:hidden">Rules</span>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <BookOpen className="h-5 w-5 text-blue-500" />
                            Oven Usage Guidelines
                        </DialogTitle>
                        <DialogDescription>
                            Please review the following rules before proceeding with your booking. These guidelines ensure fair and safe usage for everyone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <FileText className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-slate-200 text-sm">1. Form & Physical Logbook</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                    Please fill out <strong>both</strong> this digital booking form and the physical logbook located next to the oven. Do not skip either.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <ShieldAlert className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-slate-200 text-sm">2. One Active Booking Limit</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                    Maximum booking per person is <strong>1 oven</strong> at a time. You cannot book another time slot or another oven until your ongoing usage is completed.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <Clock className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-slate-200 text-sm">3. Strict Time Etiquette</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                    Booking time must match actual usage time. If you exceed your booked duration, the next user has the right to remove your sample. Please be considerate as the oven is a shared resource.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-slate-200 text-sm">4. Cancellations & Revisions</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                    You have a 15-minute grace period to Edit or Cancel your booking natively. Late cancellations will require you to send an automated WhatsApp message to the Admin grouping.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between items-center flex-col sm:flex-row gap-4 sm:gap-0 mt-4">
                        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none self-start sm:self-center">
                            <input
                                type="checkbox"
                                checked={hideThisSession}
                                onChange={(e) => setHideThisSession(e.target.checked)}
                                className="rounded border-slate-700 bg-slate-900/50 text-blue-500 focus:ring-blue-500/50 w-4 h-4 cursor-pointer"
                            />
                            Don't show again this session
                        </label>
                        <button
                            onClick={handleClose}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
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

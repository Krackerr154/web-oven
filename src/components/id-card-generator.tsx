"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/toast";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

type IDCardProps = {
    user: {
        name: string;
        nim: string | null;
        roles: string[];
        image: string | null;
        nickname?: string | null;
        supervisors: string[];
    };
};

/** Dynamic font size for name based on character length */
function getNameFontSize(name: string): string {
    const len = name.length;
    if (len <= 16) return "16px";
    if (len <= 26) return "14px";
    if (len <= 34) return "12px";
    return "11px";
}

/** Dynamic font size for supervisors based on total count */
function getSupervisorFontSize(count: number): string {
    if (count <= 1) return "12px";
    if (count <= 2) return "11px";
    return "10px";
}

export function IdCardGenerator({ user }: IDCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPng, setIsGeneratingPng] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const toast = useToast();

    const maxSupervisors = 3;
    const visibleSupervisors = (user.supervisors || []).slice(0, maxSupervisors);
    const remainingSupervisors = (user.supervisors || []).length - maxSupervisors;

    async function generateImage(): Promise<string | null> {
        if (!cardRef.current) return null;
        await document.fonts.ready;
        await new Promise((resolve) => setTimeout(resolve, 200));

        return await toPng(cardRef.current, {
            pixelRatio: 4, // 4x scale ensures crisp 300+ DPI print rasterization
            backgroundColor: "#ffffff",
        });
    }

    async function handleDownloadPng() {
        try {
            setIsGeneratingPng(true);
            const imgData = await generateImage();
            if (!imgData) return;

            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
            const safeName = user.name.replace(/[^a-zA-Z0-9]/g, "_");
            const filename = `AP_Lab_ID_${safeName}_${dateStr}.png`;

            const a = document.createElement("a");
            a.href = imgData;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.success("ID Card downloaded as PNG!");
        } catch (error) {
            console.error("PNG Generation Error:", error);
            toast.error("Failed to generate PNG. Please try again.");
        } finally {
            setIsGeneratingPng(false);
        }
    }

    async function handleDownloadPdf() {
        try {
            setIsGeneratingPdf(true);
            const imgData = await generateImage();
            if (!imgData) return;

            // Standard CR80 landscape dimensions: 85.60 mm x 53.98 mm
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: [54, 85.6],
            });

            pdf.addImage(imgData, "PNG", 0, 0, 85.6, 54);

            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
            const safeName = user.name.replace(/[^a-zA-Z0-9]/g, "_");
            const filename = `AP_Lab_ID_${safeName}_${dateStr}.pdf`;

            pdf.save(filename);
            toast.success("Print-ready PDF downloaded!");
        } catch (error) {
            console.error("PDF Generation Error:", error);
            toast.error("Failed to generate PDF. Please try again.");
        } finally {
            setIsGeneratingPdf(false);
        }
    }

    if (!user.image) return null;

    // The core card template shared between preview and high-DPI export
    const renderCardContent = () => (
        <div
            style={{
                width: "420px",
                height: "240px",
                boxSizing: "border-box",
                fontFamily: "system-ui, -apple-system, sans-serif",
                background: "#ffffff",
                border: "2px solid #0f172a",
                borderRadius: "8px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                position: "relative",
            }}
        >
            {/* Top AP-Lab Branding Header */}
            <div
                style={{
                    height: "42px",
                    background: "#0f172a",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "3px solid #ea580c",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                        style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "2px",
                            background: "#ea580c",
                        }}
                    />
                    <span
                        style={{
                            color: "#ffffff",
                            fontSize: "15px",
                            fontWeight: 900,
                            letterSpacing: "0.08em",
                        }}
                    >
                        AP-LAB
                    </span>
                </div>
                <span
                    style={{
                        color: "#94a3b8",
                        fontSize: "9px",
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                    }}
                >
                    Laboratory Member Pass
                </span>
            </div>

            {/* Card Body: Photo (Left) + Information (Right) */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    padding: "12px 18px",
                    gap: "18px",
                    background: "#ffffff",
                }}
            >
                {/* Photo Column — 3:4 Aspect Ratio */}
                <div
                    style={{
                        flexShrink: 0,
                        width: "105px",
                        height: "140px",
                        borderRadius: "4px",
                        overflow: "hidden",
                        border: "1.5px solid #0f172a",
                        background: "#f1f5f9",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={user.image!}
                        alt={user.name}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                </div>

                {/* Content Column: Nama, NIM, Dosen Pembimbing */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        height: "140px",
                        minWidth: 0,
                    }}
                >
                    {/* 1. NAMA */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span
                            style={{
                                color: "#ea580c",
                                fontSize: "8.5px",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                marginBottom: "2px",
                            }}
                        >
                            Nama
                        </span>
                        <h2
                            style={{
                                color: "#0f172a",
                                fontWeight: 900,
                                fontSize: getNameFontSize(user.name),
                                textTransform: "uppercase",
                                letterSpacing: "-0.01em",
                                lineHeight: 1.15,
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                wordBreak: "break-word",
                            }}
                        >
                            {user.name}
                        </h2>
                    </div>

                    {/* 2. NIM */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span
                            style={{
                                color: "#64748b",
                                fontSize: "8.5px",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                marginBottom: "1px",
                            }}
                        >
                            NIM
                        </span>
                        <span
                            style={{
                                color: "#0f172a",
                                fontSize: "13px",
                                fontFamily: "ui-monospace, monospace",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                            }}
                        >
                            {user.nim || "-"}
                        </span>
                    </div>

                    {/* 3. DOSEN PEMBIMBING */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span
                            style={{
                                color: "#64748b",
                                fontSize: "8.5px",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                marginBottom: "2px",
                            }}
                        >
                            Dosen Pembimbing
                        </span>
                        {visibleSupervisors.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                                {visibleSupervisors.map((spv, idx) => (
                                    <span
                                        key={idx}
                                        style={{
                                            color: "#1e293b",
                                            fontSize: getSupervisorFontSize(user.supervisors.length),
                                            fontWeight: 700,
                                            lineHeight: 1.25,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {spv}
                                    </span>
                                ))}
                                {remainingSupervisors > 0 && (
                                    <span style={{ fontSize: "9px", color: "#64748b", fontWeight: 600 }}>
                                        +{remainingSupervisors} lainnya
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>-</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Subtle Laboratory Footer */}
            <div
                style={{
                    height: "18px",
                    background: "#f8fafc",
                    borderTop: "1px solid #e2e8f0",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <span style={{ color: "#94a3b8", fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.1em" }}>
                    G-LABS AP-LAB
                </span>
                <span style={{ color: "#94a3b8", fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.1em" }}>
                    OFFICIAL LAB PASS
                </span>
            </div>
        </div>
    );

    return (
        <div className="w-full flex flex-col items-center border border-slate-700/50 bg-slate-800/30 rounded-2xl p-4 sm:p-6 mb-4 mt-6">
            <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-orange-400" />
                <h3 className="font-semibold text-white">AP-Lab Member Card</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5 text-center">
                Kartu identitas resmi AP-Lab untuk keperluan praktikum & lobi instrumen.
            </p>

            {/* Interactive Visual Card Preview */}
            <div className="w-full flex justify-center mb-6 overflow-x-auto py-2">
                <div className="shadow-2xl rounded-lg transform scale-90 sm:scale-100 transition-transform origin-center">
                    {renderCardContent()}
                </div>
            </div>

            {/* Hidden Off-Screen Rendering Node (Dedicated for High-DPI Capture) */}
            <div className="absolute left-[-9999px] top-[-9999px]">
                <div ref={cardRef}>{renderCardContent()}</div>
            </div>

            {/* Action Buttons: PNG & Print-Ready PDF */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <button
                    onClick={handleDownloadPng}
                    disabled={isGeneratingPng || isGeneratingPdf}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                    {isGeneratingPng ? (
                        <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                    ) : (
                        <Download className="h-4 w-4 text-orange-400" />
                    )}
                    <span>Download PNG</span>
                </button>

                <button
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPng || isGeneratingPdf}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
                >
                    {isGeneratingPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                        <FileText className="h-4 w-4 text-white" />
                    )}
                    <span>Print PDF (CR80)</span>
                </button>
            </div>
        </div>
    );
}

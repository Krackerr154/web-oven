"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";

// Import modules dynamically to prevent SSR issues with canvas/window
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";

type IDCardProps = {
    user: {
        name: string;
        nim: string | null;
        role: string;
        image: string | null;
        nickname?: string | null;
        supervisors: string[];
    };
};

export function IdCardGenerator({ user }: IDCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const toast = useToast();

    // The dimensions of a standard CR80 ID Card are 3.375" x 2.125" (86mm x 54mm) for landscape.
    // Using a high multiplier (4x) for HTML scale to ensure crisp rasterization.

    async function handleDownload() {
        if (!cardRef.current) return;

        try {
            setIsGenerating(true);

            // Wait a brief moment to ensure all fonts and DOM styles are completely painted
            await new Promise(resolve => setTimeout(resolve, 300));

            const imgData = await toJpeg(cardRef.current, {
                quality: 1.0,
                pixelRatio: 4, // High DPI scaling
                backgroundColor: '#ffffff' // Ensure base background
            });

            // ID dimensions in millimeters (Landscape)
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: [60, 105]
            });

            // The card element is designed at 420px x 240px (1:1 aspect ratio to 105x60 at 4x)
            pdf.addImage(imgData, "JPEG", 0, 0, 105, 60);

            // Generate proper filename with User Name and Date
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const safeName = user.name.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `Lab_Member_Card_${safeName}_${dateStr}.pdf`;

            // Force browser to respect filename by using manual anchor trick with blob
            const pdfBlob = pdf.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            toast.success("ID Card generated successfully!");

        } catch (error) {
            console.error("PDF Generation Error:", error);
            toast.error("Failed to generate ID card. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    }

    if (!user.image) return null; // Only allow PDF generation if Avatar is present

    return (
        <div className="w-full flex flex-col items-center border border-slate-700/50 bg-slate-800/20 rounded-xl p-4 sm:p-6 mb-4 mt-6">
            <h3 className="font-semibold text-white mb-1">Lab Member Card</h3>
            <p className="text-xs text-slate-400 mb-6 text-center">Export your official Lab Oven identification for physical printing.</p>

            {/* Hidden Rendering Container */}
            <div className="absolute left-[-9999px] top-[-9999px]">
                <div
                    ref={cardRef}
                    className="relative bg-white overflow-hidden flex flex-row items-center"
                    style={{
                        width: '420px',  // 105mm * 4 ratio
                        height: '240px', // 60mm * 4 ratio
                        boxSizing: 'border-box',
                        boxShadow: '0 0 0 2px #000 inset', // Black border for printing
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                >
                    <div className="flex w-full h-full px-5 py-5 items-center gap-6">
                        {/* Photo Column (Left) - Exactly 3x4 Proportions */}
                        <div className="flex flex-col items-center justify-center shrink-0 w-[120px]">
                            {/* 3x4 aspect ratio box (120px width x 160px height) */}
                            <div className="w-[120px] h-[160px] border-2 border-slate-900 rounded-sm overflow-hidden bg-slate-100 relative shadow-sm">
                                <img
                                    src={user.image}
                                    alt="User Photo"
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Information Column (Right) */}
                        <div className="flex-1 flex flex-col justify-center max-w-full">
                            <h2 className="text-[#0f172a] font-black text-[20px] uppercase tracking-tight leading-tight mb-4">
                                {user.name}
                            </h2>

                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col">
                                    <span className="text-[#64748b] text-[10px] uppercase font-bold tracking-widest">Student Identity Number</span>
                                    <span className="text-[14px] font-mono font-bold text-[#1e293b]">{user.nim || 'N/A'}</span>
                                </div>

                                <div className="flex flex-col">
                                    <span className="text-[#64748b] text-[10px] uppercase font-bold tracking-widest">Supervisor{user.supervisors && user.supervisors.length > 1 ? 's' : ''}</span>
                                    {user.supervisors && user.supervisors.length > 0 ? (
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                            {user.supervisors.map((supervisor, idx) => (
                                                <span key={idx} className="text-[13px] font-bold text-[#334155] leading-tight break-words">
                                                    {supervisor}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[13px] font-bold text-[#334155] leading-tight">N/A</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visible Trigger Action */}
            <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                ) : (
                    <Download className="h-4 w-4 text-orange-400 group-hover:-translate-y-0.5 transition-transform" />
                )}
                {isGenerating ? "Rendering PDF..." : "Download Lab Card"}
            </button>
        </div>
    );
}

function FlameIconSVG() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
        </svg>
    )
}

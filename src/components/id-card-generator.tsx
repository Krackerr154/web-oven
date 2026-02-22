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

            // Standard CR80 ID dimensions in millimeters (Landscape)
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: [54, 86]
            });

            // The card element is designed at 344px x 216px (1:1 aspect ratio to 86x54)
            pdf.addImage(imgData, "JPEG", 0, 0, 86, 54);

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
                    className="relative bg-white overflow-hidden flex flex-row items-center rounded-[8px]"
                    style={{
                        width: '344px',  // 86mm * 4 ratio
                        height: '216px', // 54mm * 4 ratio
                        boxSizing: 'border-box',
                        boxShadow: '0 0 0 1px #e2e8f0 inset', // Inner border for printing cut-lines
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                >
                    {/* Header Banner - Landscape */}
                    <div className="absolute top-0 left-0 w-full h-[36px] bg-[#f97316] flex items-center px-5">
                        <FlameIconSVG />
                        <h1 className="text-white font-bold text-[13px] tracking-widest uppercase ml-2.5">Lab Member <span className="font-medium opacity-80">Access Card</span></h1>
                    </div>

                    <div className="flex w-full h-full pt-[36px] px-5 pb-4">
                        {/* Information Column (Left) */}
                        <div className="flex-1 flex flex-col justify-center pr-3">
                            <h2 className="text-[#0f172a] font-black text-[17px] uppercase tracking-tight leading-tight mb-3 line-clamp-2">
                                {user.name}
                            </h2>

                            <div className="flex flex-col gap-2">
                                <div className="flex flex-col">
                                    <span className="text-[#64748b] text-[8px] uppercase font-bold tracking-widest">Student Identity Number</span>
                                    <span className="text-[12px] font-mono font-bold text-[#1e293b]">{user.nim || 'N/A'}</span>
                                </div>

                                <div className="flex flex-col">
                                    <span className="text-[#64748b] text-[8px] uppercase font-bold tracking-widest">Main Supervisor</span>
                                    <span className="text-[10px] font-bold text-[#334155] leading-tight line-clamp-2">
                                        {user.supervisors && user.supervisors.length > 0 ? user.supervisors.join(', ') : 'N/A'}
                                    </span>
                                </div>

                                <div className="mt-1">
                                    <span className={`text-[9px] font-bold px-2.5 py-1 rounded-sm uppercase tracking-wider ${user.role === 'ADMIN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Photo Column (Right) - Exactly 3x4 Proportions */}
                        <div className="flex flex-col items-center justify-center shrink-0 w-[105px]">
                            {/* 3x4 aspect ratio box (105px width x 140px height) */}
                            <div className="w-[105px] h-[140px] border-[3px] border-[#e2e8f0] rounded-md overflow-hidden bg-slate-100 relative shadow-sm">
                                <Image
                                    src={user.image}
                                    alt="User Photo"
                                    fill
                                    className="object-cover"
                                    unoptimized={true}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stylistic bottom tracking line */}
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-[#0f172a]"></div>
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

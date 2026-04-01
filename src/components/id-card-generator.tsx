"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { toPng } from "html-to-image";

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

/** Dynamic font size for name based on character count */
function getNameFontSize(name: string): string {
    const len = name.length;
    if (len <= 15) return "20px";
    if (len <= 25) return "17px";
    if (len <= 35) return "14px";
    return "12px";
}

/** Dynamic font size for supervisors based on count */
function getSupervisorFontSize(count: number): string {
    if (count <= 1) return "13px";
    if (count <= 2) return "12px";
    return "11px";
}

export function IdCardGenerator({ user }: IDCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const toast = useToast();

    // Limit display to 3 supervisors, show "+N more" for extras
    const maxSupervisors = 3;
    const visibleSupervisors = user.supervisors.slice(0, maxSupervisors);
    const remainingSupervisors = user.supervisors.length - maxSupervisors;

    async function handleDownload() {
        if (!cardRef.current) return;

        try {
            setIsGenerating(true);

            // Wait for fonts to be fully loaded before rendering
            await document.fonts.ready;
            // Brief additional delay for DOM paint
            await new Promise(resolve => setTimeout(resolve, 200));

            const imgData = await toPng(cardRef.current, {
                pixelRatio: 4, // High DPI for crisp output
                backgroundColor: '#ffffff',
            });

            // Generate proper filename
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const safeName = user.name.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `Lab_Member_Card_${safeName}_${dateStr}.png`;

            // Download via anchor click
            const a = document.createElement('a');
            a.href = imgData;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.success("ID Card downloaded!");

        } catch (error) {
            console.error("PNG Generation Error:", error);
            toast.error("Failed to generate ID card. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    }

    if (!user.image) return null;

    return (
        <div className="w-full flex flex-col items-center border border-slate-700/50 bg-slate-800/20 rounded-xl p-4 sm:p-6 mb-4 mt-6">
            <h3 className="font-semibold text-white mb-1">Lab Member Card</h3>
            <p className="text-xs text-slate-400 mb-6 text-center">Export your official AP-Lab identification for physical printing.</p>

            {/* Hidden Rendering Container */}
            <div className="absolute left-[-9999px] top-[-9999px]">
                <div
                    ref={cardRef}
                    style={{
                        width: '420px',   // 105mm × 4
                        height: '240px',  // 60mm × 4
                        boxSizing: 'border-box',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        background: '#ffffff',
                        border: '3px solid #1e293b',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    <div style={{ display: 'flex', width: '100%', height: '100%', padding: '16px 20px', alignItems: 'center', gap: '20px' }}>
                        {/* Photo Column (Left) — 3:4 Proportions */}
                        <div style={{ flexShrink: 0, width: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{
                                width: '120px',
                                height: '160px',
                                border: '2px solid #0f172a',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                background: '#f1f5f9',
                            }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={user.image!}
                                    alt="User Photo"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                            </div>
                        </div>

                        {/* Information Column (Right) */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                            <h2 style={{
                                color: '#0f172a',
                                fontWeight: 900,
                                fontSize: getNameFontSize(user.name),
                                textTransform: 'uppercase',
                                letterSpacing: '-0.02em',
                                lineHeight: 1.2,
                                marginBottom: '12px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                wordBreak: 'break-word',
                                margin: '0 0 12px 0',
                            }}>
                                {user.name}
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>Student Identity Number</span>
                                    <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>{user.nim || 'N/A'}</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
                                        Supervisor{user.supervisors && user.supervisors.length > 1 ? 's' : ''}
                                    </span>
                                    {user.supervisors && user.supervisors.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px' }}>
                                            {visibleSupervisors.map((supervisor, idx) => (
                                                <span
                                                    key={idx}
                                                    style={{
                                                        fontSize: getSupervisorFontSize(user.supervisors.length),
                                                        fontWeight: 700,
                                                        color: '#334155',
                                                        lineHeight: 1.3,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {supervisor}
                                                </span>
                                            ))}
                                            {remainingSupervisors > 0 && (
                                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                                                    +{remainingSupervisors} more
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', lineHeight: 1.3 }}>N/A</span>
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
                {isGenerating ? "Rendering..." : "Download Lab Card"}
            </button>
        </div>
    );
}

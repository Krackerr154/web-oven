"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Zap, Clock, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function GranularAnalyticsDashboard({ data }: { data: any }) {
    const { powerUsers, abandonmentUsers, frictionIndex, averageDurations } = data;

    return (
        <div className="space-y-8 pb-12">

            {/* 1. User Statistics */}
            <div>
                <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" /> User Statistics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-sm font-medium text-slate-300 mb-4">Most Active Users (Highest Completion)</h3>
                        <div className="space-y-3">
                            {powerUsers.map((pu: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/30">
                                    <span className="text-sm font-semibold text-white">{pu.user}</span>
                                    <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md text-xs font-mono font-bold">
                                        {pu.completedBookings} Completed
                                    </span>
                                </div>
                            ))}
                            {powerUsers.length === 0 && <p className="text-sm text-slate-500">No data available.</p>}
                        </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-sm font-medium text-slate-300 mb-4">Users with Highest Cancellations</h3>
                        <div className="space-y-3">
                            {abandonmentUsers.map((au: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/30">
                                    <span className="text-sm font-semibold text-white">{au.user}</span>
                                    <span className="bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-md text-xs font-mono font-bold">
                                        {au.cancelledBookings} Cancelled
                                    </span>
                                </div>
                            ))}
                            {abandonmentUsers.length === 0 && <p className="text-sm text-slate-500">No data available.</p>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full h-px bg-slate-800/60 my-2" />

            {/* 2. Instrument Statistics */}
            <div>
                <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-500" /> Instrument Statistics
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg h-[350px] flex flex-col">
                        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                            Cancellation Rate by Instrument (%)
                        </h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={frictionIndex} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={80} />
                                    <Tooltip
                                        cursor={{ fill: '#1e293b' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                        itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                                    />
                                    <Bar dataKey="frictionPercentage" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={25} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg h-[350px] flex flex-col">
                        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-500" /> Average Booked Duration (Hours)
                        </h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={averageDurations} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={5} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: '#1e293b' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                        itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                                    />
                                    <Bar dataKey="avgHours" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

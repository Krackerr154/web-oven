"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Filter, Users, XCircle, ArrowRightCircle, CheckCircle } from "lucide-react";

export function BookingOperationsDashboard({ data }: { data: any }) {
    const { funnel, peakDays, cancelStats } = data;

    const funnelData = [
        { name: 'Pending', count: funnel.pending, fill: '#f59e0b' },
        { name: 'Active', count: funnel.active, fill: '#3b82f6' },
        { name: 'Completed', count: funnel.completed, fill: '#10b981' }
    ];

    return (
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/60 rounded-3xl p-6 shadow-xl mb-8 flex flex-col xl:flex-row gap-6">

            {/* 1. Approval Velocity & Funnel Health */}
            <div className="flex-1 bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Funnel Health
                </h3>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={12} />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={30}>
                                {funnelData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-between items-center text-xs mt-2 px-2 text-slate-400">
                    <span className="flex items-center gap-1"><ArrowRightCircle className="w-3 h-3 text-amber-500" /> Pending</span>
                    <span className="text-slate-600">→</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3 text-blue-500" /> Active</span>
                    <span className="text-slate-600">→</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Docs</span>
                </div>
            </div>

            {/* 2. Peak Utilization Days */}
            <div className="flex-1 bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                    Weekly Congestion (Last 60 Days)
                </h3>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={peakDays} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: '#1e293b', opacity: 0.8 }}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                            />
                            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Cancellation Analysis */}
            <div className="xl:w-64 bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50 flex flex-col">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Cancellations
                </h3>
                <div className="flex-1 flex flex-col justify-center">
                    <div className="mb-4">
                        <span className="block text-3xl font-mono font-bold text-rose-400">
                            {((cancelStats.total / (funnel.total || 1)) * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-500 font-medium">overall cancellation rate</span>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-300">System Auto-Cancel</span>
                                <span className="font-mono text-slate-400">{cancelStats.auto}</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1.5">
                                <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${(cancelStats.auto / (cancelStats.total || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-300">Manual / Admin</span>
                                <span className="font-mono text-slate-400">{cancelStats.manual}</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1.5">
                                <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(cancelStats.manual / (cancelStats.total || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

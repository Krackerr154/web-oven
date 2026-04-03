"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function UtilizationChart({ trendData, utilizationData }: { trendData: any[], utilizationData: any[] }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Booking Trends over time */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/60 rounded-3xl p-7 shadow-xl h-[420px] flex flex-col">
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-white tracking-tight">Booking Trends</h3>
                    <p className="text-sm text-slate-400 mt-1">Instrument bookings over the last 6 months</p>
                </div>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: '#1e293b', opacity: 0.8 }}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                                itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                            />
                            <Bar dataKey="bookings" fill="url(#colorBlue)" radius={[6, 6, 0, 0]}>
                            </Bar>
                            <defs>
                                <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.6} />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Instrument Utilization */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/60 rounded-3xl p-7 shadow-xl h-[420px] flex flex-col">
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-white tracking-tight">Instrument Utilization</h3>
                    <p className="text-sm text-slate-400 mt-1">Total bookings distributed by instrument type</p>
                </div>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={utilizationData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={80} />
                            <Tooltip
                                cursor={{ fill: '#1e293b', opacity: 0.8 }}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                                itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                            />
                            <Bar dataKey="bookings" fill="url(#colorEmerald)" radius={[0, 6, 6, 0]} />
                            <defs>
                                <linearGradient id="colorEmerald" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                                    <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

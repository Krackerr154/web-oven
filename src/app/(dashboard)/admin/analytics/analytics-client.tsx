"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend
} from "recharts";
import { AlertCircle, Beaker, CalendarDays, FlaskConical } from "lucide-react";

interface AnalyticsClientProps {
    reagentStats: any[];
    glasswareStats: any[];
    ovenStats: any[];
}

export default function AnalyticsClient({ reagentStats, glasswareStats, ovenStats }: AnalyticsClientProps) {

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700/50 p-3 rounded-lg shadow-xl shrink-0">
                    <p className="text-sm font-medium text-slate-300 mb-1">{label}</p>
                    {payload.map((p: any, idx: number) => (
                        <p key={idx} className="text-sm font-bold" style={{ color: p.color || p.payload.fill || '#f97316' }}>
                            {p.name}: {p.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* Bookings Trend */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                        <CalendarDays className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Instrument Bookings (Last 7 Days)</h3>
                        <p className="text-xs text-slate-400">Daily active reservations across all instruments.</p>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    {ovenStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ovenStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="bookings"
                                    name="Bookings"
                                    stroke="#f97316"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#f97316", strokeWidth: 2, stroke: "#1e293b" }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                            <AlertCircle className="w-6 h-6 opacity-50" />
                            <p className="text-sm">No sufficient data for the last 7 days.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Most Borrowed Glassware */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Beaker className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-white">Top 5 Borrowed Glassware</h3>
                        <p className="text-xs text-slate-400">Based on historical loan quantities.</p>
                    </div>
                </div>

                <div className="h-[250px] w-full">
                    {glasswareStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={glasswareStats} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    width={120}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.2 }} />
                                <Bar
                                    dataKey="borrowed"
                                    name="Quantity Borrowed"
                                    fill="#3b82f6"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                            <AlertCircle className="w-6 h-6 opacity-50" />
                            <p className="text-sm">No recorded loans found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Reagents Stock Health */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <FlaskConical className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-white">Inventory Health</h3>
                        <p className="text-xs text-slate-400">Lab-owned Reagent statuses overview.</p>
                    </div>
                </div>

                <div className="h-[250px] w-full flex items-center justify-center">
                    {reagentStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={reagentStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {reagentStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value, entry: any) => (
                                        <span className="text-sm text-slate-300 capitalize">{value.toLowerCase()}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                            <AlertCircle className="w-6 h-6 opacity-50" />
                            <p className="text-sm">No reagents registered.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}

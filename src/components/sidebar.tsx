"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarDays,
  Users,
  Settings,
  ListChecks,
  LogOut,
  Flame,
  Menu,
  X,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";

const userNav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Book Oven", href: "/book", icon: CalendarPlus },
  { label: "My Bookings", href: "/my-bookings", icon: CalendarDays },
];

const adminNav = [
  { label: "Manage Users", href: "/admin/users", icon: Users },
  { label: "All Bookings", href: "/admin/bookings", icon: ListChecks },
  { label: "Oven Settings", href: "/admin/ovens", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setMobileOpen(true);
    const handleClose = () => setMobileOpen(false);
    window.addEventListener("open-mobile-sidebar", handleOpen);
    window.addEventListener("close-mobile-sidebar", handleClose);
    return () => {
      window.removeEventListener("open-mobile-sidebar", handleOpen);
      window.removeEventListener("close-mobile-sidebar", handleClose);
    };
  }, []);

  const navContent = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-6 border-b border-slate-700">
        <Flame className="h-7 w-7 text-orange-400" />
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Lab Oven</h1>
          <p className="text-xs text-slate-400">Booking System</p>
        </div>
      </div>

      {/* User Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {userNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={item.href === "/book" ? "tour-book" : undefined}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-sm font-medium transition-all duration-200 ${isActive
                ? "bg-gradient-to-r from-orange-500/20 to-orange-500/0 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.1)] border-l-2 border-orange-500"
                : "text-slate-300 hover:bg-slate-700/50 hover:text-white hover:pl-4 border-l-2 border-transparent"
                }`}
            >
              <item.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Admin
              </p>
            </div>
            {adminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-sm font-medium transition-all duration-200 ${isActive
                    ? "bg-gradient-to-r from-orange-500/20 to-orange-500/0 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.1)] border-l-2 border-orange-500"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white hover:pl-4 border-l-2 border-transparent"
                    }`}
                >
                  <item.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-slate-700 p-4 space-y-1">
        <Link
          href="/profile"
          id="tour-profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${pathname === "/profile"
            ? "bg-slate-700 text-white shadow-[0_0_15px_rgba(51,65,85,0.4)]"
            : "hover:bg-slate-700/50 hover:ring-1 hover:ring-slate-600"
            }`}
        >
          <div className="h-8 w-8 shrink-0 rounded-full bg-orange-500/20 flex items-center justify-center overflow-hidden border border-slate-600/50">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session?.user?.name || "User"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-orange-300">
                {session?.user?.name?.charAt(0).toUpperCase() || "U"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors mt-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 text-white p-2 rounded-lg shadow-lg flex items-center gap-2"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        <span className="text-sm font-semibold pr-1">Lab Oven</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 flex flex-col transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          } bg-slate-900/40 backdrop-blur-xl border-r border-slate-700/50`}
      >
        {navContent}
      </aside>
    </>
  );
}

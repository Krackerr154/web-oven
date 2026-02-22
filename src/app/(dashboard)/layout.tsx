import { Sidebar } from "@/components/sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SpotlightTour } from "@/components/onboarding-tour";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { hasSeenTour: true }
    })
    : null;
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="fixed top-0 left-1/4 w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {currentUser && <SpotlightTour hasSeenTour={currentUser.hasSeenTour} />}

      <div className="relative z-10 flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:ml-64 min-h-screen">
          <div className="w-full mx-auto p-4 pt-20 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

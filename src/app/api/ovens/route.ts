import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ovens = await prisma.oven.findMany({
    orderBy: { id: "asc" },
  });
  return NextResponse.json(ovens);
}

"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Fuse from "fuse.js";
import { revalidatePath } from "next/cache";

export type GlasswareItem = {
    id: string;
    customId: string | null;
    name: string;
    type: string;
    brand: string | null;
    size: string;
    unit: string;
    quantity: number;
    availableQuantity: number;
    condition: string | null;
    location: string | null;
    notes: string | null;
    ownerId: string | null;
    owner: { name: string | null; phone: string } | null;
    activeLoans: {
        id: string;
        quantity: number;
        purpose: string | null;
        borrowedAt: Date;
        status: string;
        user: { name: string | null; email: string };
    }[];
    updatedAt: Date;
};

/**
 * Fetch all glassware or perform a fuzzy search across the database entries.
 */
export async function getAllGlassware(query?: string): Promise<GlasswareItem[]> {
    try {
        const glassware = await prisma.glassware.findMany({
            include: {
                owner: {
                    select: { name: true, phone: true }
                },
                loans: {
                    where: { status: { in: ["PENDING_BORROW", "BORROWED", "PENDING_RETURN"] } },
                    include: {
                        user: { select: { name: true, email: true } }
                    }
                }
            },
            orderBy: { name: 'asc' },
        });

        // Map Prisma object to standard item
        const mappedData: GlasswareItem[] = glassware.map((g) => {
            const borrowedCount = g.loans.reduce((acc, loan) => acc + loan.quantity, 0);
            return {
                id: g.id,
                customId: g.customId,
                name: g.name,
                type: g.type,
                brand: g.brand,
                size: g.size,
                unit: g.unit,
                quantity: g.quantity,
                availableQuantity: Math.max(0, g.quantity - borrowedCount),
                condition: g.condition,
                location: g.location,
                notes: g.notes,
                ownerId: g.ownerId,
                owner: g.owner ? { name: g.owner.name, phone: g.owner.phone } : null,
                activeLoans: g.loans.map(l => ({
                    id: l.id,
                    quantity: l.quantity,
                    purpose: l.purpose,
                    borrowedAt: l.borrowedAt,
                    status: l.status,
                    user: {
                        name: l.user.name,
                        email: l.user.email
                    }
                })),
                updatedAt: g.updatedAt,
            };
        });

        if (!query || query.trim() === "") {
            return mappedData;
        }

        // Setup Fuse for fuzzy search
        const fuse = new Fuse(mappedData, {
            keys: [
                "name",
                "customId",
                "type",
                "brand",
                "location",
                { name: "size", weight: 0.5 },
                { name: "unit", weight: 0.5 },
            ],
            threshold: 0.3, // 0.0 is perfect match, 1.0 is match anything
            ignoreLocation: true,
        });

        const results = fuse.search(query);
        return results.map((result) => result.item);
    } catch (error) {
        console.error("Error fetching glassware:", error);
        return [];
    }
}

/**
 * Add a new glassware item to the database (Admin only)
 */
export async function addGlassware(data: {
    customId?: string;
    name: string;
    type: string;
    brand?: string;
    size: string;
    unit: string;
    quantity: number;
    condition?: string;
    location?: string;
    notes?: string;
}): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized. Admin access required." };
        }

        await prisma.glassware.create({
            data: {
                customId: data.customId || null,
                name: data.name,
                type: data.type,
                brand: data.brand || null,
                size: data.size,
                unit: data.unit,
                quantity: data.quantity,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
            }
        });

        revalidatePath("/admin/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error adding glassware:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Delete a glassware item from the database (Admin only)
 */
export async function deleteGlassware(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized. Admin access required." };
        }

        await prisma.glassware.delete({
            where: { id }
        });

        revalidatePath("/admin/glassware");
        revalidatePath("/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error deleting glassware:", error);
        return { success: false, message: "Internal server error while deleting" };
    }
}

/**
 * Add a new user-owned glassware item to the database (Any signed-in user)
 */
export async function addUserGlassware(data: {
    name: string;
    type: string;
    brand?: string;
    size: string;
    unit: string;
    quantity: number;
    condition?: string;
    location?: string;
    notes?: string;
}): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        await prisma.glassware.create({
            data: {
                name: data.name,
                type: data.type,
                brand: data.brand || null,
                size: data.size,
                unit: data.unit,
                quantity: data.quantity,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
                ownerId: session.user.id, // Explicitly tied to the requested user
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/admin/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error adding user glassware:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Edit an existing user-owned glassware item (Owner only)
 */
export async function editUserGlassware(
    id: string,
    data: {
        name: string;
        type: string;
        brand?: string;
        size: string;
        unit: string;
        quantity: number;
        condition?: string;
        location?: string;
        notes?: string;
    }
): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        // Verify ownership
        const existing = await prisma.glassware.findUnique({ where: { id } });
        if (!existing) return { success: false, message: "Glassware not found." };
        if (existing.ownerId !== session.user.id) {
            return { success: false, message: "Unauthorized. You do not own this item." };
        }

        await prisma.glassware.update({
            where: { id },
            data: {
                name: data.name,
                type: data.type,
                brand: data.brand || null,
                size: data.size,
                unit: data.unit,
                quantity: data.quantity,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/admin/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error editing user glassware:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Delete an existing user-owned glassware item (Owner only)
 */
export async function deleteUserGlassware(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        // Verify ownership before deleting
        const existing = await prisma.glassware.findUnique({ where: { id } });
        if (!existing) return { success: false, message: "Glassware not found." };
        if (existing.ownerId !== session.user.id) {
            return { success: false, message: "Unauthorized. You do not own this item." };
        }

        await prisma.glassware.delete({
            where: { id }
        });

        revalidatePath("/glassware");
        revalidatePath("/admin/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error deleting user glassware:", error);
        return { success: false, message: "Internal server error while deleting" };
    }
}

/**
 * Edit an existing lab-owned glassware item (Admin only)
 */
export async function editAdminGlassware(
    id: string,
    data: {
        customId?: string;
        name: string;
        type: string;
        brand?: string;
        size: string;
        unit: string;
        quantity: number;
        condition?: string;
        location?: string;
        notes?: string;
    }
): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized. Admin access required." };
        }

        // Verify it is lab-owned
        const existing = await prisma.glassware.findUnique({ where: { id } });
        if (!existing) return { success: false, message: "Glassware not found." };
        if (existing.ownerId !== null) {
            return { success: false, message: "Cannot edit user-owned glassware through this interface." };
        }

        await prisma.glassware.update({
            where: { id },
            data: {
                customId: data.customId || null,
                name: data.name,
                type: data.type,
                brand: data.brand || null,
                size: data.size,
                unit: data.unit,
                quantity: data.quantity,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
            }
        });

        revalidatePath("/admin/glassware");
        revalidatePath("/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error editing admin glassware:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Borrow Lab-Owned Glassware

 */
export async function borrowGlassware(glasswareId: string, quantity: number, purpose: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        // 1. Verify Glassware exists and is Lab Owned
        const item = await prisma.glassware.findUnique({
            where: { id: glasswareId },
            include: { loans: { where: { status: { in: ["PENDING_BORROW", "BORROWED", "PENDING_RETURN"] } } } }
        });

        if (!item) return { success: false, message: "Glassware not found." };
        if (item.ownerId !== null) return { success: false, message: "Cannot borrow user-owned glassware through this system. Contact the owner directly." };

        // 2. Check Available Quantity
        const borrowedCount = item.loans.reduce((acc, loan) => acc + loan.quantity, 0);
        const available = item.quantity - borrowedCount;

        if (quantity > available) {
            return { success: false, message: `Only ${available} available to borrow.` };
        }
        if (quantity <= 0) {
            return { success: false, message: "Quantity must be greater than zero." };
        }

        // 3. Create Loan Record
        await prisma.glasswareLoan.create({
            data: {
                glasswareId,
                userId: session.user.id,
                quantity,
                purpose,
                status: "PENDING_BORROW"
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware");

        return { success: true };
    } catch (error) {
        console.error("Error borrowing glassware:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * Borrow Multiple Lab-Owned Glassware Items (Cart Checkout)
 */
export async function borrowMultipleGlassware(
    items: { id: string; quantity: number; purpose: string }[]
): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        if (!items || items.length === 0) {
            return { success: false, message: "Cart is empty." };
        }

        // 1. Fetch all requested items to verify availability
        const dbItems = await prisma.glassware.findMany({
            where: { id: { in: items.map(i => i.id) } },
            include: { loans: { where: { status: { in: ["PENDING_BORROW", "BORROWED", "PENDING_RETURN"] } } } }
        });

        if (dbItems.length !== items.length) {
            return { success: false, message: "One or more items in your cart do not exist." };
        }

        // 2. Pre-flight check: Verify availability for EVERYTHING before creating any loans
        for (const reqItem of items) {
            const dbItem = dbItems.find(i => i.id === reqItem.id);
            if (!dbItem) continue;

            if (dbItem.ownerId !== null) {
                return { success: false, message: `Cannot borrow user-owned item: ${dbItem.name}.` };
            }

            if (reqItem.quantity <= 0) {
                return { success: false, message: `Invalid quantity for ${dbItem.name}.` };
            }

            const borrowedCount = dbItem.loans.reduce((acc, loan) => acc + loan.quantity, 0);
            const available = dbItem.quantity - borrowedCount;

            if (reqItem.quantity > available) {
                return { success: false, message: `Not enough stock for ${dbItem.name}. Requested: ${reqItem.quantity}, Available: ${available}.` };
            }
        }

        // 3. Execute all loans in a single transaction
        await prisma.$transaction(
            items.map(reqItem =>
                prisma.glasswareLoan.create({
                    data: {
                        glasswareId: reqItem.id,
                        userId: session.user.id,
                        quantity: reqItem.quantity,
                        purpose: reqItem.purpose,
                        status: "PENDING_BORROW"
                    }
                })
            )
        );

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware");

        return { success: true };
    } catch (error) {
        console.error("Error borrowing multiple glassware:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * User Request to Return Glassware
 */
export async function requestReturnGlassware(loanId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        const loan = await prisma.glasswareLoan.findUnique({ where: { id: loanId } });

        if (!loan) return { success: false, message: "Loan record not found." };
        if (loan.userId !== session.user.id && !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized. You did not borrow this item." };
        }
        if (loan.status !== "BORROWED") return { success: false, message: "Only actively borrowed items can be requested to return." };

        await prisma.glasswareLoan.update({
            where: { id: loanId },
            data: { status: "PENDING_RETURN" }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware/loans");
        return { success: true };
    } catch (error) {
        console.error("Error requesting return:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * Admin Confirm Return Glassware (Handles Partial/Broken Returns)
 */
export async function confirmReturnGlassware(loanId: string, returnedQty: number, brokenQty: number): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized." };
        }

        const loan = await prisma.glasswareLoan.findUnique({
            where: { id: loanId },
            include: { glassware: true } // Need parent glassware to deduct broken items
        });

        if (!loan) return { success: false, message: "Loan record not found." };
        if (loan.status === "RETURNED") return { success: false, message: "Already returned." };

        const totalAccounted = returnedQty + brokenQty;
        if (totalAccounted !== loan.quantity) {
            return { success: false, message: `Quantities mismatch. Must account for exactly ${loan.quantity} items.` };
        }

        // Transaction to ensure both the loan and parent inventory update safely
        await prisma.$transaction(async (tx: any) => {
            // 1. Mark Loan as Returned
            await tx.glasswareLoan.update({
                where: { id: loanId },
                data: {
                    status: "RETURNED",
                    returnedAt: new Date(),
                    // Optional: You could add broken tracking columns to GlasswareLoan here in the future
                }
            });

            // 2. Permanently deduct broken items from Lab Inventory
            if (brokenQty > 0) {
                await tx.glassware.update({
                    where: { id: loan.glasswareId },
                    data: {
                        quantity: {
                            decrement: brokenQty
                        }
                    }
                });
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware/loans");
        revalidatePath("/admin/glassware");

        return { success: true };
    } catch (error) {
        console.error("Error returning glassware:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * Admin Approve Borrow Request
 */
export async function approveBorrow(loanId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized." };
        }

        const loan = await prisma.glasswareLoan.findUnique({ where: { id: loanId } });
        if (!loan) return { success: false, message: "Loan record not found." };
        if (loan.status !== "PENDING_BORROW") return { success: false, message: "Only pending borrow requests can be approved." };

        await prisma.glasswareLoan.update({
            where: { id: loanId },
            data: { status: "BORROWED" }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware/loans");
        return { success: true };
    } catch (error) {
        console.error("Error approving borrow:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * Admin Reject Borrow Request
 */
export async function rejectBorrow(loanId: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized." };
        }

        const loan = await prisma.glasswareLoan.findUnique({ where: { id: loanId } });
        if (!loan) return { success: false, message: "Loan record not found." };
        if (loan.status !== "PENDING_BORROW") return { success: false, message: "Only pending borrow requests can be rejected." };

        await prisma.glasswareLoan.update({
            where: { id: loanId },
            data: {
                status: "REJECTED",
                purpose: reason ? `Rejected: ${reason}` : loan.purpose
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware/loans");
        return { success: true };
    } catch (error) {
        console.error("Error rejecting borrow:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * User Request to Return Multiple Glassware Items
 */
export async function requestMultipleReturnGlassware(loanIds: string[]): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        if (!loanIds || loanIds.length === 0) {
            return { success: false, message: "No items selected." };
        }

        const loans = await prisma.glasswareLoan.findMany({
            where: { id: { in: loanIds } }
        });

        // Validation
        const invalidLoans = loans.filter(loan => loan.userId !== session.user.id && !session.user.roles.includes("ADMIN"));
        if (invalidLoans.length > 0) {
            return { success: false, message: "Unauthorized. You did not borrow some of these items." };
        }

        const wrongStatusLoans = loans.filter(loan => loan.status !== "BORROWED");
        if (wrongStatusLoans.length > 0) {
            return { success: false, message: "Only actively borrowed items can be requested to return." };
        }

        await prisma.glasswareLoan.updateMany({
            where: { id: { in: loanIds } },
            data: { status: "PENDING_RETURN" }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware/loans");
        return { success: true };
    } catch (error) {
        console.error("Error requesting multiple returns:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * Admin Confirm Multiple Returns (Assumes 0 broken for all)
 */
export async function confirmMultipleReturnGlassware(loanIds: string[]): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized." };
        }

        if (!loanIds || loanIds.length === 0) return { success: false, message: "No items selected." };

        const loans = await prisma.glasswareLoan.findMany({
            where: { id: { in: loanIds } }
        });

        const wrongStatusLoans = loans.filter(loan => loan.status === "RETURNED");
        if (wrongStatusLoans.length > 0) {
            return { success: false, message: "Some items are already returned." };
        }

        await prisma.glasswareLoan.updateMany({
            where: { id: { in: loanIds } },
            data: {
                status: "RETURNED",
                returnedAt: new Date()
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware/loans");
        revalidatePath("/admin/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error confirming multiple returns:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * Admin Approve Multiple Borrows
 */
export async function approveMultipleBorrow(loanIds: string[]): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Unauthorized." };
        }

        if (!loanIds || loanIds.length === 0) return { success: false, message: "No items selected." };

        const loans = await prisma.glasswareLoan.findMany({
            where: { id: { in: loanIds } }
        });

        const wrongStatusLoans = loans.filter(loan => loan.status !== "PENDING_BORROW");
        if (wrongStatusLoans.length > 0) {
            return { success: false, message: "Only pending borrow requests can be approved." };
        }

        await prisma.glasswareLoan.updateMany({
            where: { id: { in: loanIds } },
            data: { status: "BORROWED" }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware/loans");
        return { success: true };
    } catch (error) {
        console.error("Error approving multiple borrows:", error);
        return { success: false, message: "Internal server error." };
    }
}

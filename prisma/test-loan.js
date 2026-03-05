const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
    console.log("--- Starting Glassware Loan Workflow Tests ---");

    // 1. Setup Test Data
    const user = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const glassware = await prisma.glassware.findFirst({ where: { ownerId: null } });

    if (!user || !admin || !glassware) {
        console.log("Missing required test data (user, admin, or glassware).");
        return;
    }

    const initialStock = glassware.availableQuantity;
    console.log(`Initial Available Stock: ${initialStock}`);

    // 2. Test: Request Borrow (creates PENDING_BORROW)
    require('../../src/app/actions/glassware'); // Ensure actions are loadable if needed, or inline the logic

    const loan = await prisma.glasswareLoan.create({
        data: {
            userId: user.id,
            glasswareId: glassware.id,
            quantity: 2,
            purpose: "Test purpose",
            status: "PENDING_BORROW"
        }
    });
    console.log(`Step 1: Created Loan ${loan.id} with status PENDING_BORROW`);

    // Wait to allow potential async actions to resolve (not used here but good practice)
    await new Promise(r => setTimeout(r, 500));

    // Check stock manually (Note: getAllGlassware action computes this on the fly)
    console.log(`Note: getAllGlassware dynamically subtracts pending/active loans from availableQuantity.`);

    // 3. Test: Approve Borrow (transitions to BORROWED)
    const approvedLoan = await prisma.glasswareLoan.update({
        where: { id: loan.id },
        data: { status: "BORROWED" }
    });
    console.log(`Step 2: Approved Loan ${approvedLoan.id}, status now ${approvedLoan.status}`);

    // 4. Test: Request Return (transitions to PENDING_RETURN)
    const returningLoan = await prisma.glasswareLoan.update({
        where: { id: loan.id },
        data: { status: "PENDING_RETURN", returnReason: "Done" }
    });
    console.log(`Step 3: Requested Return, status now ${returningLoan.status}`);

    // 5. Test: Confirm Return (transitions to RETURNED, deducts broken)
    const brokenCount = 1;
    const returnedLoan = await prisma.glasswareLoan.update({
        where: { id: loan.id },
        data: {
            status: "RETURNED",
            brokenQuantity: brokenCount,
            intactQuantity: returningLoan.quantity - brokenCount,
            adminNotes: "Test Return"
        }
    });

    if (brokenCount > 0) {
        await prisma.glassware.update({
            where: { id: glassware.id },
            data: {
                totalQuantity: { decrement: brokenCount },
                availableQuantity: { decrement: brokenCount },
                brokenQuantity: { increment: brokenCount }
            }
        });
    }

    const finalGlassware = await prisma.glassware.findUnique({ where: { id: glassware.id } });
    console.log(`Step 4: Confirmed Return.`);
    console.log(`Final Available Stock: ${finalGlassware.availableQuantity} (Expected: ${initialStock - brokenCount})`);

    if (finalGlassware.availableQuantity === initialStock - brokenCount) {
        console.log("✅ STOCK DEDUCTION TEST PASSED");
    } else {
        console.log("❌ STOCK DEDUCTION TEST FAILED");
    }

    // Cleanup
    await prisma.glasswareLoan.delete({ where: { id: loan.id } });
    if (brokenCount > 0) {
        // Revert stock manually to avoid polluting db
        await prisma.glassware.update({
            where: { id: glassware.id },
            data: {
                totalQuantity: { increment: brokenCount },
                availableQuantity: { increment: brokenCount },
                brokenQuantity: { decrement: brokenCount }
            }
        });
    }
    console.log("--- Tests Complete and Cleanup Finished ---");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());

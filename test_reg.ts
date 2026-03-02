import { registerUser } from "./src/app/actions/auth";

async function run() {
    console.log("Starting registration test...");
    const data = {
        name: "Test User",
        email: "test_new123@example.com",
        phone: "628123456780",
        nim: "99988877",
        supervisors: ["Test Supervisor"],
        password: "password123",
    };
    const result = await registerUser(data);
    console.log("Result:", result);
}

run().catch(console.error);

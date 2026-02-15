import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    status: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    status: string;
    userId: string;
  }
}

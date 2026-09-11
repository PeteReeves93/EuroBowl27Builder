import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "MEMBER" | "ADMIN";
      accessStatus: "PENDING" | "APPROVED" | "DENIED";
    } & DefaultSession["user"];
  }
}

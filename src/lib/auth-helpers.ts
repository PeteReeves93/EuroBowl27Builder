// Server-side access helpers used by pages and route handlers.

import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  name?: string | null;
  image?: string | null;
  role: "MEMBER" | "ADMIN";
  accessStatus: "PENDING" | "APPROVED" | "DENIED";
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser) ?? null;
}

export async function isApproved(): Promise<boolean> {
  const u = await getCurrentUser();
  return !!u && u.accessStatus === "APPROVED";
}

export async function isAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  return !!u && u.role === "ADMIN";
}

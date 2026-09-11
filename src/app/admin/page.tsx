import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AdminConsole from "@/components/AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Admin</h1>
      <AdminConsole />
    </div>
  );
}

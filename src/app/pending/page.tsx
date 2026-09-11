import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accessStatus === "APPROVED") redirect("/");

  const denied = user.accessStatus === "DENIED";
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">{denied ? "Access denied" : "Awaiting approval"}</h1>
      <p className="mt-3 text-gray-600">
        {denied
          ? "Your access to the roster builder has been declined. Speak to a squad admin if you think this is a mistake."
          : "Thanks for signing in! An admin needs to approve your account before you can build rosters. You'll get in as soon as they do — try again shortly."}
      </p>
    </div>
  );
}

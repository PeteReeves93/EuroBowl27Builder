import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.accessStatus === "APPROVED" ? "/" : "/pending");

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-gray-600">Use your Discord account to access the squad&apos;s roster builder.</p>
      <form action={async () => { "use server"; await signIn("discord", { redirectTo: "/" }); }} className="mt-6">
        <button className="btn btn-primary" type="submit">Sign in with Discord</button>
      </form>
    </div>
  );
}

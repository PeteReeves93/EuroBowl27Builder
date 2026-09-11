import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth-helpers";
import { signIn, signOut } from "@/auth";

export async function Header() {
  const user = await getCurrentUser();
  const approved = user?.accessStatus === "APPROVED";

  return (
    <header className="border-b-4 border-lion-red bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Team England Pathway Pals" width={40} height={48} className="h-12 w-auto" priority />
          <div className="leading-tight">
            <div className="text-sm font-black uppercase tracking-wide text-lion-red">Team England Pathway Pals</div>
            <div className="text-xs text-gray-500">NAF World Cup 2027 · Roster Builder</div>
          </div>
        </Link>

        <nav className="ml-auto flex items-center gap-2">
          <Link href="/rules" className="btn btn-ghost">Rules</Link>
          {approved && (
            <>
              <Link href="/" className="btn btn-ghost">Rosters</Link>
              <Link href="/rosters/new" className="btn btn-primary">New roster</Link>
            </>
          )}
          {user?.role === "ADMIN" && <Link href="/admin" className="btn btn-ghost">Admin</Link>}

          {user ? (
            <div className="flex items-center gap-2">
              {user.image && <Image src={user.image} alt="" width={28} height={28} className="rounded-full" />}
              <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                <button className="btn btn-ghost" type="submit">Sign out</button>
              </form>
            </div>
          ) : (
            <form action={async () => { "use server"; await signIn("discord"); }}>
              <button className="btn btn-primary" type="submit">Sign in with Discord</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}

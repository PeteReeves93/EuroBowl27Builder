import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getLatestRulepack, getTeamsData, getSkillsData } from "@/lib/data";
import RosterBuilder from "@/components/RosterBuilder";

export const dynamic = "force-dynamic";

export default async function NewRosterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accessStatus !== "APPROVED") redirect("/pending");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">New roster</h1>
      <RosterBuilder teamsData={getTeamsData()} rulepack={getLatestRulepack()} skills={getSkillsData()} />
    </div>
  );
}

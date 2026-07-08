import { requireProfile } from "@/lib/auth";
import { UsersClient } from "./UsersClient";

export default async function UsersSettingsPage() {
  const { user, profile } = await requireProfile();

  if (profile.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-zinc-900">Users</h1>
        <p className="text-sm text-zinc-500">Only admins can manage users.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Users</h1>
      <UsersClient currentUserId={user.id} />
    </div>
  );
}

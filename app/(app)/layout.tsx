import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireProfile();

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user.email ?? ""} fullName={profile.full_name} role={profile.role} />
      <main className="flex-1 overflow-y-auto bg-zinc-50 p-6">{children}</main>
    </div>
  );
}

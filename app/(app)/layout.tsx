import { isOwner, requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authed = await requireProfile();
  const { user, profile } = authed;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={user.email ?? ""}
        fullName={profile.full_name}
        role={profile.role}
        isOwner={isOwner(authed)}
      />
      <main className="flex-1 overflow-y-auto bg-zinc-50 p-6 print:overflow-visible print:bg-white print:p-0">
        {children}
      </main>
    </div>
  );
}

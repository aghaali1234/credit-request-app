import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin-logout-button";
import { UserDashboard } from "@/components/user-dashboard";
import { getAdminSession } from "@/lib/admin-auth";
import { getInspectableUser } from "@/lib/user-dashboard/server";

export default async function AdminUserDashboardPage({
  params,
}: PageProps<"/admin/users/[userId]/dashboard">) {
  const { userId } = await params;
  const { response: adminResponse } = await getAdminSession();

  if (adminResponse) {
    if (adminResponse.status === 401) {
      redirect("/");
    }

    notFound();
  }

  const { user, response } = await getInspectableUser(userId);

  if (response || !user) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700 dark:text-blue-400">
              Admin Inspection
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Viewing dashboard for: {user.salespersonName}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Read-only view. Credit request creation and user data mutations
              are disabled.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
            >
              Back to Admin Dashboard
            </Link>
            <AdminLogoutButton />
          </div>
        </div>

        <UserDashboard
          subjectUserId={user.id}
          frameTitle="Selected User Dashboard"
          selectedUserLabel={user.salespersonName}
          inspectMode
        />
      </div>
    </main>
  );
}

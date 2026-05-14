export default function ProfileLoading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_42%)] px-4 py-8 text-zinc-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,_#09090b_0%,_#18181b_48%)] dark:text-zinc-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/70 bg-white/85 p-8 text-center shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
          <div
            aria-hidden="true"
            className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-700 dark:border-sky-950 dark:border-t-sky-300"
          />
          <div className="space-y-1">
            <p className="text-base font-semibold">Profile loading...</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Preparing salesperson analytics.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

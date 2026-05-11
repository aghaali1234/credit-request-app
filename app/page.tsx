export default function Home() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-950">
      <section className="relative isolate flex min-h-screen items-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1800&q=80')",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-black/55" />

        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
          <div className="max-w-3xl text-white">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-orange-300">
              Team Hair Pro
            </p>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Signature Style.
              <span className="block">Elevated You.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
              Book your next appointment with our Tenafly stylists and enjoy a personalized salon experience from consultation to finish.
            </p>
          </div>

          <section
            aria-label="Book an appointment"
            className="vagaro-widget-shell w-full justify-self-center rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/35 sm:p-6 lg:max-w-[520px]"
          >
            <div className="border-t border-zinc-300 pt-5">
              <h2 className="text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl">
                TEAM HAIR PRO
              </h2>
              <p className="mt-1 text-2xl text-zinc-800">Tenafly, NJ</p>
            </div>

            <form
              className="mt-8 space-y-4"
              action="#"
              aria-label="Vagaro appointment search"
            >
              <label className="flex min-h-16 items-center gap-3 rounded border border-zinc-300 px-4 text-2xl text-zinc-800 sm:min-h-20 sm:text-3xl">
                <span aria-hidden="true" className="text-3xl">
                  ⌕
                </span>
                <span>Select Service</span>
              </label>
              <label className="flex min-h-16 items-center rounded border border-zinc-300 px-4 text-2xl text-zinc-800 sm:min-h-20 sm:text-3xl">
                ANDY C.
              </label>
              <label className="flex min-h-16 items-center rounded border border-zinc-300 px-4 text-2xl text-zinc-800 sm:min-h-20 sm:text-3xl">
                May 10, 2026
              </label>
              <button
                className="min-h-16 w-full rounded bg-orange-500 text-3xl font-medium text-white transition hover:bg-orange-600 sm:min-h-20"
                type="button"
              >
                Search
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}

import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import creditAppLogo from "@/components/creditapp.png";
import { LoginForm } from "@/components/login-form";
import { authOptions } from "@/lib/auth";

type HomeProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

function normalizeSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;
  const initialError = normalizeSearchParam(error) ? "Invalid username or password." : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0e1a] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_45%)]" />

      <section className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#141a2e] p-8 shadow-xl shadow-black/40 backdrop-blur-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src={creditAppLogo}
            alt="Turkana"
            priority
            className="mb-4 h-24 w-auto"
          />
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Turkana Supply Chain Portal
          </h1>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">Sign in</h2>
          <p className="mt-1 text-sm text-indigo-200/70">
            Supply chain operations &amp; vendor portal.
          </p>
        </div>

        <LoginForm initialError={initialError} />
      </section>
    </main>
  );
}

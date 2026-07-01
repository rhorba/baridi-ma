import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Baridi.ma</h1>
      <p className="text-[var(--color-text-muted)]">Cold-chain logistics tracker — under construction.</p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded bg-[var(--color-primary)] px-4 py-2 font-medium text-white">
          Log in
        </Link>
        <Link href="/register" className="rounded border border-[var(--color-primary)] px-4 py-2 font-medium">
          Register
        </Link>
      </div>
    </main>
  );
}

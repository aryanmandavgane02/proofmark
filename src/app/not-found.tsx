import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-4 py-20">
      <LogoMark className="h-10 w-10" />
      <h1 className="mt-6 text-2xl font-bold text-primary-d">This page does not exist</h1>
      <p className="mt-2 text-muted">The draft may belong to another demo workspace, or the link is mistyped. Each demo workspace is private to the browser that started it.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/app" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-d">Go to your workspace</Link>
        <Link href="/" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-primary-d hover:bg-soft">Home</Link>
      </div>
    </main>
  );
}

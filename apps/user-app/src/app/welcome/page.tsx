import Link from "next/link";

export default function WelcomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 h-20 w-20 rounded-2xl bg-brand/10" />
      <h1 className="mb-2 text-2xl font-semibold">Vision Guard</h1>
      <p className="mb-10 text-sm text-slate-500">
        La surveillance intelligente, simple et propulsée par l'IA.
      </p>
      <Link
        href="/login"
        className="w-full max-w-xs rounded-xl bg-brand py-3 text-sm font-medium text-white"
      >
        Commencer
      </Link>
    </div>
  );
}

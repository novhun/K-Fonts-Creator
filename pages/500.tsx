import Link from "next/link";

export default function Custom500() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0d12] text-white p-4 text-center">
      <h1 className="text-4xl font-bold text-red-400 mb-2">500</h1>
      <p className="text-sm text-white/50 mb-6">Internal Server Error</p>
      <Link
        href="/"
        className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

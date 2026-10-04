import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-brand-700 text-sm font-semibold">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <LinkButton href="/dashboard" className="mt-6">
          Go to dashboard
        </LinkButton>
      </div>
    </main>
  );
}

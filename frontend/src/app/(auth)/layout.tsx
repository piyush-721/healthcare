import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="from-brand-50/60 to-canvas flex min-h-screen flex-col bg-gradient-to-b">
      <header className="px-4 py-5 sm:px-8">
        <Logo />
      </header>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-slate-500">
        HealthOS organizes health information. It does not provide medical advice. In an emergency,
        contact your local emergency services.
      </footer>
    </div>
  );
}

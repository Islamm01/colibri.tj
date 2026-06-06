import Link from 'next/link';
import { LoginForm } from '@/components/staff/LoginForm';
import { readStaffSession, roleHomePath } from '@/lib/staff/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StaffLoginPage() {
  const session = await readStaffSession();
  if (session) redirect(roleHomePath(session.role));

  return (
    <div className="min-h-dvh flex flex-col bg-cream relative">
      {/* Back to home — top-left, always reachable */}
      <Link
        href="/"
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-ink-muted hover:text-fig-700 hover:bg-white/60 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        На главную
      </Link>

      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          {/* Brand mark — transparent SVG, no frame, no dark background */}
          <div className="flex flex-col items-center text-center mb-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/colibri-mark.png"
              alt="Colibri"
              width={140}
              height={140}
              className="select-none"
              draggable={false}
            />
          </div>

          <div className="bg-white rounded-2xl border border-black/[0.05] p-5 shadow-card">
            <LoginForm />
          </div>

          <p className="mt-5 text-[11px] text-ink-faint text-center leading-relaxed max-w-[260px] mx-auto">
            Доступ только для сотрудников Colibri. Логин и пароль предоставляются администратором.
          </p>
        </div>
      </div>
    </div>
  );
}

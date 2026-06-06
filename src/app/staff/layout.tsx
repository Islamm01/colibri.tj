import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Colibri · Staff',
  robots: { index: false, follow: false },
};

export default function StaffRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-ink">
      {children}
    </div>
  );
}

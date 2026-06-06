import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/config';

// Explicit root-route handler. Belt-and-suspenders alongside the middleware:
// if anyone visits `/` directly (or middleware doesn't fire for any reason),
// this redirects to the default locale cleanly.
export default function RootPage() {
  redirect(`/${defaultLocale}`);
}

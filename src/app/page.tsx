import { redirect } from 'next/navigation';

// Entry point → dashboard (which bounces to /login when unauthenticated).
export default function Home() {
  redirect('/dashboard');
}

import { ButtonLink } from '../../components/ui';

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-500">404</p>
      <h1 className="mt-4 text-2xl font-bold">This page could not be found</h1>
      <p className="mt-2 text-ink-500">The link may be broken or the page may have moved.</p>
      <ButtonLink to="/" className="mt-8">
        Go to the homepage
      </ButtonLink>
    </section>
  );
}

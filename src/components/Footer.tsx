const REPO_URL = 'https://github.com/akshajmurhekar/ai-nutri-tracker';

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2 text-center text-xs text-zinc-400 dark:text-zinc-600">
      {'We ❤️ open source'} ·{' '}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-zinc-500 underline underline-offset-2 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        Link
      </a>
    </footer>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-300 bg-surface-50 text-gray-500">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm">
            &copy; {year} VictrixHominum. Built with React &amp; Tailwind.
          </p>
          <a
            href="https://github.com/VictrixHominum"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:text-gray-300 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

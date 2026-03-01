import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { MouseEvent } from 'react';

export interface CardProps {
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  coverImage?: string;
  slug: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export function Card({
  title,
  excerpt,
  date,
  tags,
  coverImage,
  slug,
  onClick,
}: CardProps) {
  const formattedDate = formatDate(date);

  return (
    <Link
      to={`/blog/${slug}`}
      onClick={onClick}
      className="group block rounded-xl bg-surface-50 border border-surface-200 overflow-hidden transition-all duration-200 hover:border-surface-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
    >
      {coverImage && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-5">
        <time
          dateTime={date}
          className="block text-xs text-gray-500 mb-2 font-mono"
        >
          {formattedDate}
        </time>

        <h3 className="text-lg font-semibold text-gray-100 mb-2 line-clamp-2 group-hover:text-primary-400 transition-colors duration-150">
          {title}
        </h3>

        <p className="text-sm text-gray-400 mb-4 line-clamp-3 leading-relaxed">
          {excerpt}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-surface-200 text-gray-300 border border-surface-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function formatDate(dateStr: string): string {
  try {
    const parsed = parseISO(dateStr);
    return format(parsed, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

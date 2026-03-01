import { useRef, useState, useCallback, useEffect } from 'react';
import { Card } from './Card.tsx';

export interface BlogPostMeta {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  tags: string[];
  coverImage?: string;
  author: string;
}

export interface CarouselProps {
  items: BlogPostMeta[];
  title: string;
}

export function Carousel({ items, title }: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    el.addEventListener('scroll', checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [checkScroll, items]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const cardWidth = el.querySelector(':scope > *')?.clientWidth ?? 320;
    const gap = 24;
    const distance = cardWidth + gap;

    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-100">{title}</h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className="p-2 rounded-lg bg-surface-100 border border-surface-300 text-gray-300 transition-colors duration-150 hover:bg-surface-200 hover:text-gray-100 disabled:opacity-0 disabled:pointer-events-none"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className="p-2 rounded-lg bg-surface-100 border border-surface-300 text-gray-300 transition-colors duration-150 hover:bg-surface-200 hover:text-gray-100 disabled:opacity-0 disabled:pointer-events-none"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scroll-smooth scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <div key={item.slug} className="w-80 flex-shrink-0">
            <Card
              title={item.title}
              slug={item.slug}
              date={item.date}
              excerpt={item.excerpt}
              tags={item.tags}
              coverImage={item.coverImage}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

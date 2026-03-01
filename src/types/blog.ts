export type PostStatus = 'published' | 'draft';

export interface BlogPostMeta {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  tags: string[];
  coverImage?: string;
  author: string;
  status: PostStatus;
}

export interface BlogPost extends BlogPostMeta {
  content: string;
}

export type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';

export interface BlogFormData {
  title: string;
  excerpt: string;
  tags: string;
  coverImage: string;
  content: string;
}

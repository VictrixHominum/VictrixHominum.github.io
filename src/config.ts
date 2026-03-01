export const config = {
  github: {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
    oauthWorkerUrl: import.meta.env.VITE_OAUTH_WORKER_URL || '',
    owner: import.meta.env.VITE_GITHUB_OWNER || 'VictrixHominum',
    repo: import.meta.env.VITE_GITHUB_REPO || 'VictrixHominum.github.io',
  },
  blog: {
    postsDirectory: 'content/posts',
    imagesDirectory: 'public/images/blog',
    recentPostDays: 30,
  },
  site: {
    title: 'VictrixHominum',
    description: 'Developer Blog & Portfolio',
  },
} as const;

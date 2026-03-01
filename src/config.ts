export const config = {
  github: {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
    owner: import.meta.env.VITE_GITHUB_OWNER || 'VictrixHominum',
    repo: import.meta.env.VITE_GITHUB_REPO || 'VictrixHominum.github.io',
  },
  blog: {
    recentPostDays: 30,
  },
  site: {
    title: 'VictrixHominum',
    description: 'Developer Blog & Portfolio',
  },
} as const;

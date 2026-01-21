// GitHub Issues Integration (no auth required for public repos)

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  url: string;
  state: string;
  labels: { name: string; color: string }[];
  assignee?: { login: string };
  created_at: string;
}

// Parse GitHub URL to extract owner/repo
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Match github.com/owner/repo or github.com/owner/repo/...
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  }
  return null;
}

// Fetch issues from a public GitHub repo
export async function fetchGitHubIssues(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open"
): Promise<GitHubIssue[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=50`;

  console.log(`\x1b[38;5;141m[github]\x1b[0m Fetching issues from ${owner}/${repo}`);

  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "OpenUI-Agent-Manager",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`\x1b[38;5;141m[github]\x1b[0m API error:`, res.status, text);
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();

  // Filter out pull requests (they come through the issues API too)
  const issues = data
    .filter((item: any) => !item.pull_request)
    .map((issue: any) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      state: issue.state,
      labels: issue.labels.map((l: any) => ({ name: l.name, color: l.color })),
      assignee: issue.assignee ? { login: issue.assignee.login } : undefined,
      created_at: issue.created_at,
    }));

  console.log(`\x1b[38;5;141m[github]\x1b[0m Found ${issues.length} issues`);
  return issues;
}

// Fetch a single issue by number
export async function fetchGitHubIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssue | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "OpenUI-Agent-Manager",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const issue = await res.json();

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    labels: issue.labels.map((l: any) => ({ name: l.name, color: l.color })),
    assignee: issue.assignee ? { login: issue.assignee.login } : undefined,
    created_at: issue.created_at,
  };
}

// Search issues in a repo
export async function searchGitHubIssues(
  owner: string,
  repo: string,
  query: string
): Promise<GitHubIssue[]> {
  const searchQuery = `${query} repo:${owner}/${repo} is:issue`;
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=20`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "OpenUI-Agent-Manager",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();

  return data.items.map((issue: any) => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    labels: issue.labels.map((l: any) => ({ name: l.name, color: l.color })),
    assignee: issue.assignee ? { login: issue.assignee.login } : undefined,
    created_at: issue.created_at,
  }));
}

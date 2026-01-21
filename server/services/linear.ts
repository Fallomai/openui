import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { LinearTicket, LinearConfig } from "../types";

const LAUNCH_CWD = process.env.LAUNCH_CWD || process.cwd();
const CONFIG_FILE = join(LAUNCH_CWD, ".openui", "config.json");
const ENV_FILE = join(LAUNCH_CWD, ".openui", ".env");

// Load .env file from .openui directory
function loadEnvFile(): Record<string, string> {
  try {
    if (existsSync(ENV_FILE)) {
      const content = readFileSync(ENV_FILE, "utf-8");
      const vars: Record<string, string> = {};
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          if (key && valueParts.length > 0) {
            let value = valueParts.join("=");
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            vars[key.trim()] = value;
          }
        }
      }
      return vars;
    }
  } catch (e) {
    console.error("Failed to load .env file:", e);
  }
  return {};
}

// Save API key to .env file
function saveEnvFile(apiKey: string): void {
  try {
    const dir = join(LAUNCH_CWD, ".openui");
    if (!existsSync(dir)) {
      require("fs").mkdirSync(dir, { recursive: true });
    }

    let content = "";
    if (existsSync(ENV_FILE)) {
      // Preserve other vars, update LINEAR_API_KEY
      const existing = readFileSync(ENV_FILE, "utf-8");
      const lines = existing.split("\n").filter(line => !line.trim().startsWith("LINEAR_API_KEY="));
      content = lines.join("\n");
      if (content && !content.endsWith("\n")) content += "\n";
    }

    if (apiKey) {
      content += `LINEAR_API_KEY="${apiKey}"\n`;
    }

    writeFileSync(ENV_FILE, content);
  } catch (e) {
    console.error("Failed to save .env file:", e);
  }
}

// Load config - API key from .env, other settings from config.json
export function loadConfig(): LinearConfig {
  const envVars = loadEnvFile();
  const config: LinearConfig = {};

  // API key from .env file (or process.env as fallback)
  config.apiKey = envVars.LINEAR_API_KEY || process.env.LINEAR_API_KEY;

  console.log(`\x1b[38;5;141m[linear]\x1b[0m Loading config from:`, ENV_FILE);
  console.log(`\x1b[38;5;141m[linear]\x1b[0m ENV file exists:`, existsSync(ENV_FILE));
  console.log(`\x1b[38;5;141m[linear]\x1b[0m API key from env vars:`, !!envVars.LINEAR_API_KEY, envVars.LINEAR_API_KEY ? `(${envVars.LINEAR_API_KEY.substring(0, 10)}...)` : '');
  console.log(`\x1b[38;5;141m[linear]\x1b[0m API key from process.env:`, !!process.env.LINEAR_API_KEY);

  // Other settings from config.json
  try {
    if (existsSync(CONFIG_FILE)) {
      const fileConfig = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
      config.defaultTeamId = fileConfig.defaultTeamId;
      config.defaultBaseBranch = fileConfig.defaultBaseBranch;
      config.createWorktree = fileConfig.createWorktree;
      config.ticketPromptTemplate = fileConfig.ticketPromptTemplate;
    }
  } catch (e) {
    console.error("Failed to load config:", e);
  }

  return config;
}

// Save config - API key to .env, other settings to config.json
export function saveConfig(config: LinearConfig): void {
  // Save API key to .env file
  if (config.apiKey !== undefined) {
    saveEnvFile(config.apiKey);
  }

  // Save other settings to config.json (without the API key)
  try {
    const dir = join(LAUNCH_CWD, ".openui");
    if (!existsSync(dir)) {
      require("fs").mkdirSync(dir, { recursive: true });
    }
    const fileConfig = {
      defaultTeamId: config.defaultTeamId,
      defaultBaseBranch: config.defaultBaseBranch,
      createWorktree: config.createWorktree,
      ticketPromptTemplate: config.ticketPromptTemplate,
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(fileConfig, null, 2));
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}

// Linear GraphQL API
const LINEAR_API = "https://api.linear.app/graphql";

async function linearQuery(apiKey: string, query: string, variables?: any) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey, // Linear expects just the key, not "Bearer key"
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Linear API error ${res.status}:`, text);
    throw new Error(`Linear API error: ${res.status}`);
  }

  const data = await res.json();
  if (data.errors) {
    console.error("Linear GraphQL errors:", data.errors);
    throw new Error(data.errors[0]?.message || "Linear API error");
  }

  return data.data;
}

// Fetch teams
export async function fetchTeams(apiKey: string) {
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;
  const data = await linearQuery(apiKey, query);
  return data.teams.nodes;
}

// Fetch active tickets (not completed/canceled)
export async function fetchMyTickets(apiKey: string, teamId?: string): Promise<LinearTicket[]> {
  // Build filter dynamically to avoid GraphQL syntax errors
  // Don't filter by assignee - show all active tickets
  const filterParts = [
    'state: { type: { nin: ["completed", "canceled"] } }',
  ];
  if (teamId) {
    filterParts.push(`team: { id: { eq: "${teamId}" } }`);
  }

  const query = `
    query {
      issues(
        filter: { ${filterParts.join(", ")} }
        first: 50
        orderBy: updatedAt
      ) {
        nodes {
          id
          identifier
          title
          url
          priority
          state {
            name
            color
          }
          assignee {
            name
          }
          team {
            name
            key
          }
        }
      }
    }
  `;

  console.log(`\x1b[38;5;141m[linear]\x1b[0m Fetching tickets with filter:`, filterParts.join(", "));

  const data = await linearQuery(apiKey, query);

  console.log(`\x1b[38;5;141m[linear]\x1b[0m Tickets found:`, data.issues?.nodes?.length || 0);

  return data.issues.nodes;
}

// Search tickets
export async function searchTickets(apiKey: string, searchTerm: string, teamId?: string): Promise<LinearTicket[]> {
  const filterParts = ['state: { type: { nin: ["completed", "canceled"] } }'];
  if (teamId) {
    filterParts.push(`team: { id: { eq: "${teamId}" } }`);
  }

  const query = `
    query($searchTerm: String!) {
      issueSearch(
        query: $searchTerm
        filter: { ${filterParts.join(", ")} }
        first: 20
      ) {
        nodes {
          id
          identifier
          title
          url
          priority
          state {
            name
            color
          }
          assignee {
            name
          }
          team {
            name
            key
          }
        }
      }
    }
  `;
  const data = await linearQuery(apiKey, query, { searchTerm });
  return data.issueSearch.nodes;
}

// Fetch single ticket by identifier (e.g., "PROJ-123")
export async function fetchTicketByIdentifier(apiKey: string, identifier: string): Promise<LinearTicket | null> {
  const query = `
    query($identifier: String!) {
      issue(id: $identifier) {
        id
        identifier
        title
        url
        priority
        state {
          name
          color
        }
        assignee {
          name
        }
        team {
          name
          key
        }
      }
    }
  `;

  try {
    // Try searching by identifier
    const searchQuery = `
      query($term: String!) {
        issueSearch(query: $term, first: 1) {
          nodes {
            id
            identifier
            title
            url
            priority
            state {
              name
              color
            }
            assignee {
              name
            }
            team {
              name
              key
            }
          }
        }
      }
    `;
    const data = await linearQuery(apiKey, searchQuery, { term: identifier });
    return data.issueSearch.nodes[0] || null;
  } catch (e) {
    return null;
  }
}

// Validate API key
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const query = `query { viewer { id name } }`;
    await linearQuery(apiKey, query);
    return true;
  } catch {
    return false;
  }
}

// Get current user info
export async function getCurrentUser(apiKey: string) {
  const query = `
    query {
      viewer {
        id
        name
        email
      }
    }
  `;
  const data = await linearQuery(apiKey, query);
  return data.viewer;
}

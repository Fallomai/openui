# OpenUI Status Plugin for Claude Code

This plugin reports Claude Code agent status to OpenUI in real-time, enabling accurate status display (Working, Using Tools, Idle, etc.) on your agent nodes.

## Installation

### For Development / Testing

Run Claude Code with the plugin directory flag:

```bash
claude --plugin-dir /path/to/openui/claude-code-plugin
```

### For Permanent Use

Add the plugin directory to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "plugins": ["/path/to/openui/claude-code-plugin"]
}
```

Or if you cloned/installed OpenUI globally, you can reference it directly.

## Configuration

The plugin uses these environment variables (with defaults):

- `OPENUI_HOST` - OpenUI server host (default: `localhost`)
- `OPENUI_PORT` - OpenUI server port (default: `4242`)

If your OpenUI server runs on a different port, set these before starting Claude Code:

```bash
export OPENUI_PORT=8080
claude --plugin-dir /path/to/openui/claude-code-plugin
```

## How It Works

The plugin uses Claude Code hooks to detect status changes:

| Hook Event | Status Reported |
|------------|-----------------|
| `SessionStart` | `starting` |
| `UserPromptSubmit` | `running` |
| `PreToolUse` | `tool_calling` |
| `PostToolUse` | `running` |
| `Stop` | `idle` |
| `SubagentStop` | `running` |
| `Notification` (idle_prompt) | `waiting_input` |
| `SessionEnd` | `disconnected` |

Status updates are sent via HTTP POST to `http://{OPENUI_HOST}:{OPENUI_PORT}/api/status-update`.

## Verifying Installation

1. Start Claude Code with the plugin: `claude --plugin-dir /path/to/openui/claude-code-plugin`
2. Run `/plugins` to see installed plugins - you should see `openui-status`
3. Start working - OpenUI should now show accurate status updates

## Troubleshooting

If status isn't updating:

1. Verify plugin is loaded: run `/plugins` in Claude Code
2. Check OpenUI server is running on the expected port
3. Check OpenUI server logs for incoming status updates (look for `[plugin]` messages)
4. Ensure the `hooks/status-reporter.sh` script is executable (`chmod +x`)

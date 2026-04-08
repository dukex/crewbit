# Run multiple crewbit personas simultaneously

This guide explains how to run several crewbit daemons in parallel on the same repository — for example, a developer, a QA bot, and a release manager all working at the same time.

## Prerequisites

Read [How crewbit works](../explanation/how-it-works.md) first, specifically the section on worktree isolation, before following this guide.

## Make each daemon's `worktreePrefix` unique

Every daemon must have a distinct `worktreePrefix` under `git:`:

```yaml
# dev-junior.yaml
git:
  worktreePrefix: dev-junior

# qa-bot.yaml
git:
  worktreePrefix: qa-bot

# releaser.yaml
git:
  worktreePrefix: releaser
```

**What breaks if two daemons share a prefix:** crewbit names its temporary worktree branches `worktree-<prefix>-<issueKey>`. Two daemons with the same prefix will both try to manage the same worktree and branch name for the same issue. When one daemon hits a `git worktree add` conflict, it will tear down the existing worktree/branch and retry, so the more likely outcome is that one daemon deletes the other daemon's active worktree mid-session rather than the second daemon simply failing to start.

## Avoid transition overlap

Two daemons should never be configured to pick up issues from the same status. If both `dev-junior.yaml` and `qa-bot.yaml` have a transition with `from: In Progress`, they will race to grab the same issue.

Partition statuses explicitly:

```yaml
# dev-junior.yaml — owns "To Do" and "Accepted"
transitions:
  Done:
    from: Accepted
    command: /merge
  Start:
    from: To Do
    command: /develop

# qa-bot.yaml — owns "In Review"
transitions:
  Test:
    from: In Review
    command: /run-tests
```

Each status should appear as a `from` value in at most one daemon's config.

## Separate log output per daemon

Pass each daemon's output to its own log file when you start it. With a plain shell invocation:

```bash
crewbit ./dev-junior.yaml >> logs/dev-junior.log 2>&1 &
crewbit ./qa-bot.yaml    >> logs/qa-bot.log    2>&1 &
crewbit ./releaser.yaml  >> logs/releaser.log  2>&1 &
```

Each process writes to its own file so log lines from different daemons never interleave.

## Run as a background service

### systemd (Linux)

Create one unit file per persona. Save the following as `/etc/systemd/system/crewbit-dev-junior.service`:

```ini
[Unit]
Description=crewbit dev-junior daemon
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/your/repo
ExecStart=/usr/local/bin/crewbit /path/to/dev-junior.yaml
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=inherit
EnvironmentFile=/etc/crewbit/dev-junior.env

[Install]
WantedBy=multi-user.target
```

Create `/etc/crewbit/dev-junior.env` with restrictive permissions and your credentials:

```bash
sudo mkdir -p /etc/crewbit
sudo install -m 600 /dev/null /etc/crewbit/dev-junior.env
echo "JIRA_EMAIL=you@example.com" | sudo tee -a /etc/crewbit/dev-junior.env
echo "JIRA_API_TOKEN=your-token"  | sudo tee -a /etc/crewbit/dev-junior.env
```

Repeat with different names and config paths for each persona, then enable them:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crewbit-dev-junior
sudo systemctl enable --now crewbit-qa-bot
```

Check logs with:

```bash
journalctl -u crewbit-dev-junior -f
```

### launchd (macOS)

Save the following as `~/Library/LaunchAgents/sh.crewbit.dev-junior.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>sh.crewbit.dev-junior</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/crewbit</string>
    <string>/path/to/dev-junior.yaml</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/your/repo</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>JIRA_EMAIL</key>
    <string>you@example.com</string>
    <key>JIRA_API_TOKEN</key>
    <string>your-token</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/crewbit-dev-junior.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/crewbit-dev-junior.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

Load it with:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/sh.crewbit.dev-junior.plist
```

Create a separate plist for each persona.

### PM2 (cross-platform)

PM2 works on both Linux and macOS and keeps a process list across reboots.

Create a `crewbit-ecosystem.config.js` file:

```js
module.exports = {
  apps: [
    {
      name: "dev-junior",
      script: "crewbit",
      args: "./dev-junior.yaml",
      cwd: "/path/to/your/repo",
      out_file: "./logs/dev-junior.log",
      error_file: "./logs/dev-junior.log",
      env: {
        JIRA_EMAIL: "you@example.com",
        JIRA_API_TOKEN: "your-token",
      },
    },
    {
      name: "qa-bot",
      script: "crewbit",
      args: "./qa-bot.yaml",
      cwd: "/path/to/your/repo",
      out_file: "./logs/qa-bot.log",
      error_file: "./logs/qa-bot.log",
      env: {
        JIRA_EMAIL: "you@example.com",
        JIRA_API_TOKEN: "your-token",
      },
    },
  ],
};
```

Start all daemons and save the process list:

```bash
pm2 start crewbit-ecosystem.config.js
pm2 save
pm2 startup   # prints a command to run so PM2 restarts on reboot
```

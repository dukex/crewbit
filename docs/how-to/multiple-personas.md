# Run multiple crewbit personas simultaneously

This guide shows how to run more than one crewbit daemon at the same time, each with a different role.

## One YAML file per persona

Each daemon instance is driven by its own workflow YAML. Give every persona a unique `daemon.worktreePrefix`:

`dev-junior.yaml`:

```yaml
daemon:
  worktreePrefix: dev-junior
```

`qa-agent.yaml`:

```yaml
daemon:
  worktreePrefix: qa-agent
```

crewbit names git worktrees and temporary branches using the prefix. If two daemons share a prefix they will try to create identically named branches and worktrees, which causes conflicts and unpredictable failures.

## Avoid transition overlap

If two personas both watch the same `from` status they will race to claim the same issues. Assign each persona a unique status column:

| Persona | from status |
|---|---|
| dev-junior | Ready |
| qa-agent | In Review |

This way each daemon operates on a separate part of the board and issues flow through the pipeline without contention.

## Run as a systemd service (Linux)

Create a unit file for each persona, for example `/etc/systemd/system/crewbit-dev-junior.service`:

```ini
[Unit]
Description=crewbit dev-junior persona
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/myrepo
EnvironmentFile=/etc/crewbit/dev-junior.env
ExecStart=/usr/local/bin/crewbit /etc/crewbit/dev-junior.yaml
StandardOutput=append:/var/log/crewbit/dev-junior.log
StandardError=append:/var/log/crewbit/dev-junior.log
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Store credentials in the `EnvironmentFile` (for example `JIRA_EMAIL`, `JIRA_API_TOKEN`, or `GITHUB_TOKEN`) so they are not in the unit file.

Enable and start each service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crewbit-dev-junior
sudo systemctl enable --now crewbit-qa-agent
```

Follow logs:

```bash
journalctl -fu crewbit-dev-junior
```

## Run as a launchd service (macOS)

Create a plist for each persona at `~/Library/LaunchAgents/com.crewbit.dev-junior.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.crewbit.dev-junior</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/crewbit</string>
    <string>/Users/deploy/crewbit/dev-junior.yaml</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>JIRA_EMAIL</key>
    <string>bot@example.com</string>
    <key>JIRA_API_TOKEN</key>
    <string>your-token-here</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/usr/local/var/log/crewbit-dev-junior.log</string>
  <key>StandardErrorPath</key>
  <string>/usr/local/var/log/crewbit-dev-junior.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

Load the service:

```bash
launchctl load ~/Library/LaunchAgents/com.crewbit.dev-junior.plist
```

## Separate log output per daemon

Whether you use systemd, launchd, or a plain shell script, redirect each daemon's stdout and stderr to a separate file:

```bash
crewbit ./dev-junior.yaml >> /var/log/crewbit/dev-junior.log 2>&1 &
crewbit ./qa-agent.yaml   >> /var/log/crewbit/qa-agent.log   2>&1 &
```

This keeps log output from different personas from interleaving, which makes it much easier to trace what each daemon is doing.

## Further reading

For details on how worktrees are created and cleaned up, see [../explanation/how-it-works](../explanation/how-it-works).

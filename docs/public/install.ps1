#Requires -Version 5.1
<#
.SYNOPSIS
    crewbit Installer for Windows.

.DESCRIPTION
    Downloads the latest crewbit release from GitHub and installs it under
    %USERPROFILE%\.crewbit\bin (configurable). Adds the install directory to
    the User PATH unless -NoModifyPath is set.

.PARAMETER Version
    Install a specific version (e.g. v1.5.1).

.PARAMETER Binary
    Install from a local binary instead of downloading.

.PARAMETER InstallDir
    Install to a custom directory.

.PARAMETER NoModifyPath
    Don't modify the User PATH environment variable.

.PARAMETER Help
    Show usage information.

.EXAMPLE
    irm https://crewbit.sh/install.ps1 | iex

.EXAMPLE
    & ([scriptblock]::Create((irm https://crewbit.sh/install.ps1))) -Version v1.5.1
#>
[CmdletBinding()]
param(
    [Alias('v')]
    [string]$Version,

    [Alias('b')]
    [string]$Binary,

    [Alias('d')]
    [string]$InstallDir,

    [switch]$NoModifyPath,

    [Alias('h')]
    [switch]$Help
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# Force TLS 1.2 — Windows PowerShell 5.1 defaults to TLS 1.0/1.1 which GitHub no longer accepts.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$App  = 'crewbit'
$Repo = 'dukex/crewbit'

# Fall back to environment variables when params aren't bound (e.g. `irm | iex` invocation).
if (-not $Version) { $Version = $env:CREWBIT_VERSION }
if (-not $InstallDir) {
    $InstallDir = if ($env:CREWBIT_INSTALL_DIR) {
        $env:CREWBIT_INSTALL_DIR
    } else {
        Join-Path $env:USERPROFILE '.crewbit\bin'
    }
}
if (-not $NoModifyPath) {
    if ($env:CREWBIT_NO_MODIFY_PATH -in @('1', 'true', 'TRUE', 'yes')) {
        $NoModifyPath = $true
    }
}

function Show-Usage {
    @"
crewbit Installer (Windows)

Usage: install.ps1 [options]

Options:
  -Help                    Display this help message
  -Version <version>       Install a specific version (e.g., v1.5.1)
  -Binary <path>           Install from a local binary instead of downloading
  -InstallDir <dir>        Install to a custom directory
  -NoModifyPath            Don't modify the User PATH

Examples:
  irm https://crewbit.sh/install.ps1 | iex
  `$env:CREWBIT_VERSION='v1.5.1'; irm https://crewbit.sh/install.ps1 | iex
  & ([scriptblock]::Create((irm https://crewbit.sh/install.ps1))) -Version v1.5.1
"@
}

function Write-Info    ($msg) { Write-Host $msg }
function Write-Warn    ($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-ErrLine ($msg) { Write-Host $msg -ForegroundColor Red }

if ($Help) {
    Show-Usage
    return
}

function Get-Platform {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        'AMD64' { return 'windows-x64' }
        'ARM64' {
            Write-ErrLine "Unsupported architecture: $arch (Windows arm64 binaries are not yet published)."
            exit 1
        }
        default {
            Write-ErrLine "Unsupported architecture: $arch"
            exit 1
        }
    }
}

function Get-LatestVersion {
    $api = "https://api.github.com/repos/$Repo/releases/latest"
    try {
        $release = Invoke-RestMethod -Uri $api -UseBasicParsing
    } catch {
        Write-ErrLine "Failed to fetch latest version: $($_.Exception.Message)"
        exit 1
    }
    return $release.tag_name
}

function Resolve-VersionAndUrl ($platform) {
    if (-not $Version) {
        $resolved = Get-LatestVersion
        if (-not $resolved) {
            Write-ErrLine 'Failed to fetch latest version'
            exit 1
        }
    } else {
        $resolved = if ($Version -like 'v*') { $Version } else { "v$Version" }
        $tagUrl = "https://github.com/$Repo/releases/tag/$resolved"
        try {
            Invoke-WebRequest -Uri $tagUrl -Method Head -UseBasicParsing -ErrorAction Stop | Out-Null
        } catch [System.Net.WebException] {
            $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
            if ($code -eq 404) {
                Write-ErrLine "Release $resolved not found"
                Write-Info  "Available releases: https://github.com/$Repo/releases"
            } else {
                Write-ErrLine "Failed to validate release $resolved (HTTP $code)"
            }
            exit 1
        }
    }

    $url = "https://github.com/$Repo/releases/download/$resolved/$App-$platform.exe"
    return [pscustomobject]@{ Version = $resolved; Url = $url }
}

function Save-Binary ($url, $output) {
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
}

function Confirm-InstallDir {
    if (-not (Test-Path -LiteralPath $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
}

function Install-Binary ($sourcePath) {
    Confirm-InstallDir
    $target = Join-Path $InstallDir "$App.exe"
    Move-Item -LiteralPath $sourcePath -Destination $target -Force
}

function Install-FromLocal {
    if (-not (Test-Path -LiteralPath $Binary)) {
        Write-ErrLine "Binary not found at $Binary"
        exit 1
    }
    $tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName() + '.exe')
    Copy-Item -LiteralPath $Binary -Destination $tmp -Force
    Install-Binary $tmp
}

function Update-UserPath {
    if ($NoModifyPath) { return }

    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = if ($current) { $current -split ';' } else { @() }

    foreach ($entry in $entries) {
        if ($entry -and ($entry.TrimEnd('\') -ieq $InstallDir.TrimEnd('\'))) {
            Write-Info "$InstallDir is already on the User PATH."
            return
        }
    }

    $newPath = if ($current) { "$current;$InstallDir" } else { $InstallDir }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    $env:Path = "$env:Path;$InstallDir"

    Write-Info "Added $InstallDir to the User PATH."
    Write-Info 'Open a new shell for the change to take effect.'
}

function Test-ExistingInstall ($targetPath) {
    $cmd = Get-Command $App -ErrorAction SilentlyContinue
    if (-not $cmd) { return }

    $existing = $cmd.Source
    if (-not $existing) { return }

    if ($existing -ne $targetPath) {
        Write-Warn "Found existing $App at $existing."
        Write-Warn "This install will place $App at $targetPath."
        Write-Warn 'You may want to remove the older binary or update your PATH.'
    }
}

function Invoke-Main {
    $target = Join-Path $InstallDir "$App.exe"

    if ($Binary) {
        Write-Info "Installing $App from local binary"
        Test-ExistingInstall $target
        Install-FromLocal
        Update-UserPath
        Write-Info "Done! $App installed to $target"
        Write-Info "Run: $App .\your-agent.yaml"
        return
    }

    $platform = Get-Platform
    $resolved = Resolve-VersionAndUrl $platform

    $tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName() + '.exe')

    Write-Info "Installing $App $($resolved.Version) ($platform)"
    Test-ExistingInstall $target
    Save-Binary $resolved.Url $tmp
    Install-Binary $tmp
    Update-UserPath

    Write-Info "Done! $App installed to $target"
    Write-Info "Run: $App .\your-agent.yaml"
}

Invoke-Main

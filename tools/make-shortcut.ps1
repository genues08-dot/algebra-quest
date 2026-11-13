# Creates "Algebra Quest.lnk" in the project root.
# The shortcut opens offline.html in its own Edge window, with no tabs or address bar. Since the offline
# version was retired, offline.html erases the old PC progress and opens the online app.
# Run this again if the project folder moves: the paths are rebuilt from this script's location.
$root = Split-Path -Parent $PSScriptRoot

$edge = $null
foreach ($base in ${env:ProgramFiles(x86)}, $env:ProgramFiles) {
    if (-not $base) { continue }
    $candidate = Join-Path $base 'Microsoft\Edge\Application\msedge.exe'
    if (Test-Path $candidate) { $edge = $candidate; break }
}
if (-not $edge) {
    Write-Error 'Microsoft Edge was not found. Install Edge, then run this script again.'
    exit 1
}

$indexPath = Join-Path $root 'offline.html'
$shortcutPath = Join-Path $root 'Algebra Quest.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $edge
$shortcut.Arguments = '--app="' + ([uri]$indexPath).AbsoluteUri + '"'
$shortcut.IconLocation = Join-Path $root 'icon.ico'
$shortcut.WorkingDirectory = $root
$shortcut.Description = 'Algebra Quest'
$shortcut.Save()
Write-Output "Created shortcut: $shortcutPath"

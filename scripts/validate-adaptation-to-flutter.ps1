$ErrorActionPreference = "Stop"

function Get-SearchableFiles {
  param(
    [string[]]$Paths
  )

  $selfPath = (Resolve-Path -LiteralPath $PSCommandPath).Path
  $files = New-Object System.Collections.Generic.List[string]

  foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }

    $item = Get-Item -LiteralPath $path
    if ($item.PSIsContainer) {
      Get-ChildItem -LiteralPath $item.FullName -Recurse -File | ForEach-Object {
        if ($_.FullName -ne $selfPath) {
          $files.Add($_.FullName)
        }
      }
      continue
    }

    if ($item.FullName -ne $selfPath) {
      $files.Add($item.FullName)
    }
  }

  return $files
}

function Invoke-SearchAllowNoMatches {
  param(
    [string]$Pattern,
    [string[]]$Paths
  )

  $files = Get-SearchableFiles -Paths $Paths
  if ($files.Count -eq 0) {
    return
  }

  $totalChars = ($files | Measure-Object -Property Length -Sum).Sum
  $canUseRg = (Get-Command rg -ErrorAction SilentlyContinue) -and $files.Count -lt 256 -and $totalChars -lt 7000

  if ($canUseRg) {
    try {
      & rg -n -S $Pattern @files
      if ($LASTEXITCODE -gt 1) {
        throw "rg falhou com exit code $LASTEXITCODE."
      }
      return
    } catch {
      $message = $_.Exception.Message
      if (
        $message -notmatch "nome do arquivo ou a extensão é muito grande" -and
        $message -notmatch "The filename or extension is too long"
      ) {
        throw
      }
    }
  }

  $matches = Select-String -Path $files -Pattern $Pattern -AllMatches
  if ($matches) {
    $matches | ForEach-Object {
      "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()
    }
  }
}

$env:PUPPETEER_SKIP_DOWNLOAD = "true"
$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if (Test-Path $chrome) {
  $env:PUPPETEER_EXECUTABLE_PATH = $chrome
} elseif (Test-Path $edge) {
  $env:PUPPETEER_EXECUTABLE_PATH = $edge
} else {
  Write-Error "Chrome/Edge local não encontrado para puppeteer-core."
}

Write-Host "== git =="
git branch --show-current
git status --short --untracked-files=all

Write-Host "== no playwright =="
Invoke-SearchAllowNoMatches "playwright|@playwright/test|playwright-core|npx playwright|ms-playwright" @(
  "package.json",
  "package-lock.json",
  "tests",
  "scripts",
  "cli",
  "docs",
  "README.md",
  "README.npm.md",
  "skill"
)

Write-Host "== no bun scripts =="
Invoke-SearchAllowNoMatches "bun:test|runner: 'bun'|bun run|bun install|bun audit|import\.meta\.dir" @(
  "tests",
  "scripts",
  "package.json",
  "docs",
  "README.md",
  "README.npm.md"
)

Write-Host "== npm deps =="
npm ls playwright playwright-core @playwright/test puppeteer-core --depth=0

Write-Host "== gates =="
npm run build:skills
npm run test
npm run test:skill-behavior

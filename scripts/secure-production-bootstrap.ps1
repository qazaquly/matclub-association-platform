param(
  [Parameter(Mandatory = $true)][string]$ConnectionFile,
  [Parameter(Mandatory = $true)][string]$StatusFile,
  [switch]$ResumeAfterPresident,
  [switch]$VerifyOnly,
  [switch]$SetExistingPasswords
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore

function Request-AccountPassword([string]$AccountName) {
  $window = New-Object System.Windows.Window
  $window.Title = "Secure Phase 1 Production Bootstrap"
  $window.Width = 520
  $window.Height = 330
  $window.WindowStartupLocation = "CenterScreen"
  $window.ResizeMode = "NoResize"
  $window.Topmost = $true

  $panel = New-Object System.Windows.Controls.StackPanel
  $panel.Margin = "28"
  $window.Content = $panel

  $heading = New-Object System.Windows.Controls.TextBlock
  $heading.Text = $AccountName
  $heading.FontSize = 19
  $heading.FontWeight = "SemiBold"
  $heading.Margin = "0,0,0,18"
  $panel.Children.Add($heading) | Out-Null

  $labelOne = New-Object System.Windows.Controls.TextBlock
  $labelOne.Text = "Password (14–128 characters)"
  $panel.Children.Add($labelOne) | Out-Null
  $passwordOne = New-Object System.Windows.Controls.PasswordBox
  $passwordOne.Margin = "0,6,0,14"
  $passwordOne.Height = 34
  $panel.Children.Add($passwordOne) | Out-Null

  $labelTwo = New-Object System.Windows.Controls.TextBlock
  $labelTwo.Text = "Confirm password"
  $panel.Children.Add($labelTwo) | Out-Null
  $passwordTwo = New-Object System.Windows.Controls.PasswordBox
  $passwordTwo.Margin = "0,6,0,10"
  $passwordTwo.Height = 34
  $panel.Children.Add($passwordTwo) | Out-Null

  $errorText = New-Object System.Windows.Controls.TextBlock
  $errorText.Foreground = "Firebrick"
  $errorText.Height = 26
  $panel.Children.Add($errorText) | Out-Null

  $buttonPanel = New-Object System.Windows.Controls.StackPanel
  $buttonPanel.Orientation = "Horizontal"
  $buttonPanel.HorizontalAlignment = "Right"
  $panel.Children.Add($buttonPanel) | Out-Null

  $cancel = New-Object System.Windows.Controls.Button
  $cancel.Content = "Cancel"
  $cancel.Width = 90
  $cancel.Height = 34
  $cancel.Margin = "0,0,10,0"
  $cancel.Add_Click({
    $window.DialogResult = $false
    $window.Close()
  })
  $buttonPanel.Children.Add($cancel) | Out-Null

  $continue = New-Object System.Windows.Controls.Button
  $continue.Content = "Continue"
  $continue.Width = 100
  $continue.Height = 34
  $continue.IsDefault = $true
  $continue.Add_Click({
    if ($passwordOne.Password.Length -lt 14 -or $passwordOne.Password.Length -gt 128) {
      $errorText.Text = "Password must be between 14 and 128 characters."
      return
    }
    if ($passwordOne.Password -cne $passwordTwo.Password) {
      $errorText.Text = "Passwords do not match."
      return
    }
    $window.Tag = $passwordOne.Password
    $passwordOne.Clear()
    $passwordTwo.Clear()
    $window.DialogResult = $true
    $window.Close()
  })
  $buttonPanel.Children.Add($continue) | Out-Null

  $passwordOne.Focus() | Out-Null
  if ($window.ShowDialog() -ne $true) { throw "PASSWORD_ENTRY_CANCELLED" }
  return [string]$window.Tag
}

$workspace = Split-Path -Parent $PSScriptRoot
$presidentPassword = $null
$vp2Password = $null
$directUrl = $null

try {
  $promptNote = if ($SetExistingPasswords) {
    " — set the password now (then verify live)"
  } elseif ($VerifyOnly) {
    " — enter the existing password (verification only)"
  } else {
    ""
  }
  $presidentPassword = Request-AccountPassword ("President — Ырысбек Мәуіт" + $promptNote)
  $vp2Password = Request-AccountPassword ("Vice President 2 — Саясат Идеятұлы" + $promptNote)
  $directUrl = (Get-Content -Raw -LiteralPath $ConnectionFile).Trim()
  if (-not $directUrl.StartsWith("postgres://")) { throw "DIRECT_CONNECTION_INVALID" }

  $env:ENVIRONMENT = "production"
  $env:DIRECT_URL = $directUrl

  Push-Location -LiteralPath $workspace
  if (-not $ResumeAfterPresident -and -not $VerifyOnly) {
    $env:BOOTSTRAP_ADMIN_ROLE = "president"
    $env:BOOTSTRAP_ADMIN_EMAIL = "irisbekmauit@gmail.com"
    $env:BOOTSTRAP_ADMIN_PASSWORD = $presidentPassword
    $env:BOOTSTRAP_ADMIN_FULL_NAME = "Ырысбек Мәуіт"
    $env:BOOTSTRAP_ADMIN_REGION_CODE = "AST"
    $env:BOOTSTRAP_ADMIN_CITY_DISTRICT = "Астана"
    $env:BOOTSTRAP_ADMIN_PHONE = "+7 702 612 0275"
    & pnpm.cmd run bootstrap:production-admin *> $null
    if ($LASTEXITCODE -ne 0) { throw "PRESIDENT_BOOTSTRAP_FAILED" }
  }

  if (-not $VerifyOnly) {
    $env:BOOTSTRAP_ADMIN_ROLE = "vice_president_2"
    $env:BOOTSTRAP_ADMIN_EMAIL = "sayasat.ideyatuly@gmail.com"
    $env:BOOTSTRAP_ADMIN_PASSWORD = $vp2Password
    $env:BOOTSTRAP_ADMIN_FULL_NAME = "Саясат Идеятұлы"
    $env:BOOTSTRAP_ADMIN_REGION_CODE = "AST"
    $env:BOOTSTRAP_ADMIN_CITY_DISTRICT = "Астана"
    $env:BOOTSTRAP_ADMIN_PHONE = "+7 747 517 4247"
    & pnpm.cmd run bootstrap:production-admin *> $null
    if ($LASTEXITCODE -ne 0) { throw "VP2_BOOTSTRAP_FAILED" }
  }

  if ($SetExistingPasswords) {
    $env:BOOTSTRAP_ADMIN_ROLE = "president"
    $env:BOOTSTRAP_ADMIN_EMAIL = "irisbekmauit@gmail.com"
    $env:BOOTSTRAP_ADMIN_PASSWORD = $presidentPassword
    $ErrorActionPreference = "Continue"
    & pnpm.cmd run set:production-admin-password *> $null
    $passwordSetExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($passwordSetExitCode -ne 0) { throw "PRESIDENT_PASSWORD_SET_FAILED" }

    $env:BOOTSTRAP_ADMIN_ROLE = "vice_president_2"
    $env:BOOTSTRAP_ADMIN_EMAIL = "sayasat.ideyatuly@gmail.com"
    $env:BOOTSTRAP_ADMIN_PASSWORD = $vp2Password
    $ErrorActionPreference = "Continue"
    & pnpm.cmd run set:production-admin-password *> $null
    $passwordSetExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($passwordSetExitCode -ne 0) { throw "VP2_PASSWORD_SET_FAILED" }
  }

  $env:PRODUCTION_BASE_URL = "https://matclub.bilimnews.workers.dev/"
  $env:VERIFY_PRESIDENT_EMAIL = "irisbekmauit@gmail.com"
  $env:VERIFY_PRESIDENT_PASSWORD = $presidentPassword
  $env:VERIFY_VP2_EMAIL = "sayasat.ideyatuly@gmail.com"
  $env:VERIFY_VP2_PASSWORD = $vp2Password
  $ErrorActionPreference = "Continue"
  $verificationOutput = & pnpm.cmd run verify:production-governance 2>$null
  $verificationExitCode = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  $verificationJson = $verificationOutput | Where-Object { $_ -match "^\{" } | Select-Object -Last 1
  if ($verificationJson) {
    [System.IO.File]::WriteAllText($StatusFile, [string]$verificationJson, [System.Text.UTF8Encoding]::new($false))
  }
  if ($verificationExitCode -ne 0 -or -not $verificationJson) { throw "PRODUCTION_VERIFICATION_FAILED" }
  [System.Windows.MessageBox]::Show(
    "Both production accounts were created and the live governance checks passed.",
    "Phase 1 production bootstrap",
    "OK",
    "Information"
  ) | Out-Null
} catch {
  $failureStage = if ($_.Exception.Message -match "^[A-Z0-9_]+$") { $_.Exception.Message } else { "UNEXPECTED_FAILURE" }
  if (-not (Test-Path -LiteralPath $StatusFile -PathType Leaf)) {
    [System.IO.File]::WriteAllText(
      $StatusFile,
      ('{"bothAccountsCreated":false,"bothProductionLoginsPassed":false,"bothHaveFullGlobalAccess":false,"roleManagementRestrictedToPresidentAndVp2":false,"auditLoggingPassed":false,"failureStage":"' + $failureStage + '"}'),
      [System.Text.UTF8Encoding]::new($false)
    )
  }
  [System.Windows.MessageBox]::Show(
    "The secure bootstrap did not complete. No password was logged. Codex will recover safely.",
    "Phase 1 production bootstrap",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
} finally {
  if ((Get-Location).Path -eq $workspace) { Pop-Location }
  foreach ($name in @(
    "ENVIRONMENT", "DIRECT_URL", "BOOTSTRAP_ADMIN_ROLE", "BOOTSTRAP_ADMIN_EMAIL",
    "BOOTSTRAP_ADMIN_PASSWORD", "BOOTSTRAP_ADMIN_FULL_NAME", "BOOTSTRAP_ADMIN_REGION_CODE",
    "BOOTSTRAP_ADMIN_CITY_DISTRICT", "BOOTSTRAP_ADMIN_PHONE", "PRODUCTION_BASE_URL",
    "VERIFY_PRESIDENT_EMAIL", "VERIFY_PRESIDENT_PASSWORD", "VERIFY_VP2_EMAIL", "VERIFY_VP2_PASSWORD"
  )) {
    Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
  }
  $presidentPassword = $null
  $vp2Password = $null
  $directUrl = $null
}

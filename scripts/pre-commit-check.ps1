<#
.SYNOPSIS
  EduERP-V4 提交前安全检查 (PowerShell 核心逻辑, 由 pre-commit-check.bat 调用)

.DESCRIPTION
  用法:
    .\scripts\pre-commit-check.ps1            # 检查暂存区 (默认)
    .\scripts\pre-commit-check.ps1 -All       # 检查整个工作树
    .\scripts\pre-commit-check.ps1 <path...>  # 检查指定文件/目录

  退出码: 0 = PASS / 1 = FAIL / 2 = 用法错误
#>
[CmdletBinding()]
param(
    [switch]$All,
    [switch]$Untracked,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Paths
)

$ErrorActionPreference = 'Stop'

$repoRoot = & git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Error 'ERROR: not inside a git repository'
    exit 2
}
Set-Location $repoRoot

# 受信任的守卫文件(创建时人工审查), 不参与自检
$guardRegex = 'docs/SECURITY-COMMIT-RULES\.md|docs/evidence/M-EDUOS-SECURITY-COMMIT-GUARD-V1\.md|scripts/pre-commit-check\.(sh|bat|ps1)$|scripts/install-pre-commit-hook\.sh|\.gitignore|README\.md'

# 校验正则
$ipRegex      = '([0-9]{1,3}\.){3}[0-9]{1,3}'
$ipAllowlist  = @('127.0.0.1','0.0.0.0','192.168.1.1','192.168.1.100')
$ddnsRegex    = '[a-z0-9_-]+\.(ddns|f3322|nat123|3322\.org|oray|no-ip|dyndns|synology\.me|quickconnect|tplinkdns|asuscomm)'
$keyRegex     = 'BEGIN (RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_|xox[baprs]-[A-Za-z0-9-]{10,}'
$credRegex    = '(password|passwd|secret|api[_-]?key|client[_-]?secret|access[_-]?key|token)\s*[:=]\s*["'']?[^"'':=\s][^\s"'']*'
$portRegex    = 'port[_-]?forward|dnat|prerouting|masquerade|proxy_pass|autossh|ssh -[LR] ?[0-9]|virtual server|端口映射|端口转发'

$binaryExt = '\.(png|jpg|jpeg|gif|ico|bmp|exe|dll|db|sqlite|sqlite3|pdf|zip|gz|7z|tsbuildinfo|woff|ttf)$'

# 收集待检查文件
if ($All) {
    $files = @(git ls-files) + @(git ls-files --others --exclude-standard)
} elseif ($Untracked) {
    $files = @(git ls-files --others --exclude-standard)
} elseif ($Paths.Count -gt 0) {
    $files = $Paths
} else {
    $files = @(git diff --cached --name-only --diff-filter=ACM)
}

if ($files.Count -eq 0 -or ($files.Count -eq 1 -and [string]::IsNullOrWhiteSpace($files[0]))) {
    Write-Output '[PASS] 无待检查文件'
    exit 0
}

$violations = 0
$warnings = 0

function Test-Placeholder([string]$value) {
    # 含非 ASCII 字符(如中文占位文本 生产密码/示例)
    if ($value -match '[^\x00-\x7F]') { return $true }
    # 占位词 / 环境变量引用
    if ($value -match 'your_|your-|xxx|example|changeme|change-this|change_this|todo|placeholder|redacted|^<.*>$|^\$') { return $true }
    # 高相似度密码形态: 长度>=8 且同时含大小写字母与数字
    if ($value.Length -ge 8 -and $value -match '[A-Z]' -and $value -match '[a-z]' -and $value -match '[0-9]') { return $false }
    # 短标识符(变量名, <=16字符)
    if ($value -match '^[A-Za-z_][A-Za-z0-9_]{0,15}$') { return $true }
    # 函数调用引用
    if ($value -match '^[A-Za-z_][A-Za-z0-9_.]*\(.*\)$') { return $true }
    # 点号引用 (如 process.env.X / config.DB_PASSWORD)
    if ($value -match '^[A-Za-z_][A-Za-z0-9_.]*\.[A-Za-z_][A-Za-z0-9_.]*$') { return $true }
    return $false
}

function Add-Violation([string]$category, [string]$file, [int]$line, [string]$text) {
    Write-Output ("[FAIL] [{0}] {1}:{2}: {3}" -f $category, $file, $line, $text.Trim())
    $script:violations++
}

function Add-Warning([string]$category, [string]$file, [int]$line, [string]$text) {
    Write-Output ("[WARN] [{0}] {1}:{2}: {3}" -f $category, $file, $line, $text.Trim())
    $script:warnings++
}

function Scan-File([string]$f) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { return }
    if ($f -match $binaryExt) { return }
    if ($f -match $guardRegex) { return }
    # 跳过超大文件(>5MB, 多为构建产物/数据文件)
    if ((Get-Item -LiteralPath $f).Length -gt 5242880) { return }

    $content = Get-Content -Raw -LiteralPath $f -ErrorAction SilentlyContinue
    if ($null -eq $content) { return }
    if ($content.Contains([char]0)) { return }   # 二进制
    $lines = $content -split "`r?`n"

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $num = $i + 1

        # 1) IP 地址
        $ipMatches = [regex]::Matches($line, $ipRegex)
        foreach ($m in $ipMatches) {
            if ($ipAllowlist -contains $m.Value) { continue }
            Add-Violation 'IP地址' $f $num $m.Value
        }

        # 2) DDNS / 动态域名
        if ($line -match $ddnsRegex) {
            Add-Violation 'DDNS域名' $f $num $line
        }

        # 3a) 密钥/Token 明确指纹
        if ($line -match $keyRegex) {
            Add-Violation '密钥/Token' $f $num $line
        }

        # 3b) password/secret/token 赋值
        $credMatches = [regex]::Matches($line, $credRegex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        foreach ($m in $credMatches) {
            $whole = $m.Value
            $keyPart = ($whole -split '[=:]', 2)[0]
            $valuePart = ($whole -split '[=:]', 2)[1].TrimStart('"', "'", ' ').TrimEnd(';', ',')
            if (Test-Placeholder $valuePart) { continue }
            if ($keyPart -match '^SEED_') {
                Add-Warning '种子密码(开发环境)' $f $num $whole
                continue
            }
            Add-Violation '密码/密钥赋值' $f $num $whole
        }

        # 4) 端口转发 / 反代 / 隧道
        if ($line -match $portRegex) {
            Add-Violation '端口转发/反代' $f $num $line
        }
    }
}

Write-Output '== EduERP-V4 Commit Guard (pre-commit-check) =='
if ($All) { Write-Output '== 扫描范围: all (工作树) ==' }
elseif ($Untracked) { Write-Output '== 扫描范围: untracked (未跟踪文件) ==' }
elseif ($Paths.Count -gt 0) { Write-Output '== 扫描范围: paths ==' }
else { Write-Output '== 扫描范围: staged (暂存区) ==' }

foreach ($f in $files) {
    if ([string]::IsNullOrWhiteSpace($f)) { continue }
    Scan-File $f
}

Write-Output '----------------------------------------'
if ($violations -gt 0) {
    Write-Output ("[FAIL] 发现 {0} 处敏感内容，已阻止提交。请脱敏后重试 (见 docs/SECURITY-COMMIT-RULES.md §4)。" -f $violations)
    if ($warnings -gt 0) { Write-Output ("      另有 {0} 处告警(开发种子密码)，请人工确认。" -f $warnings) }
    exit 1
}
if ($warnings -gt 0) {
    Write-Output ("[PASS] 无阻断项 (含 {0} 处告警，请人工确认)。" -f $warnings)
    exit 0
}
Write-Output '[PASS] 未发现敏感内容。'
exit 0

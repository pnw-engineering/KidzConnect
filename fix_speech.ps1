# Fix the speech button icon
$scriptPath = "script.js"
$content = Get-Content $scriptPath -Raw -Encoding UTF8

# Replace the broken character pattern with the microphone emoji
$fixed = $content -replace 'speechBtn\.textContent = speechMuted \? "🤫" : "[^"]*";', 'speechBtn.textContent = speechMuted ? "🤫" : "🎤";'

# Write back with proper encoding
$fixed | Set-Content $scriptPath -Encoding UTF8
Write-Host "Fixed speech button icon"
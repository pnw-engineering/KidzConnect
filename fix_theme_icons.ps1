# Fix theme button icons
$content = Get-Content "script.js" -Raw -Encoding UTF8

# Replace the sun icon (broken encoding to proper sun)
$content = $content.Replace('â˜€ï¸', '☀️')

# Replace the moon icon (broken encoding to proper moon) 
$content = $content.Replace('ðŸŒ™', '🌙')

# Write back to file
$content | Out-File "script.js" -Encoding UTF8 -NoNewline

Write-Host "Theme icons fixed!"
Write-Host "==================================================" -ForegroundColor Green
Write-Host "       Subiendo actualizaciones a GitHub..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
git add .
git commit -m "Actualizacion automatica MathQuest V4"
git push origin main
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  ¡Hecho! Tu juego se actualizara en linea." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar..."

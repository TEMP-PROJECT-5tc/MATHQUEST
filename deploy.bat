@echo off
echo ==================================================
echo       Subiendo actualizaciones a GitHub...
echo ==================================================
git add .
git commit -m "Actualizacion automatica MathQuest V4"
git push origin main
echo ==================================================
echo  ¡Hecho! Tu juego se actualizara en linea en breve.
echo ==================================================
pause

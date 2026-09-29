@echo off
rem Gera uma animacao no ComfyUI aberto. Uso: gerar_comfy.bat [animacao] [direcao] [quadros]
rem Ex.: gerar_comfy.bat correr S 1   (testa so o primeiro quadro)
set PY=%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI\.venv\Scripts\python.exe
if not exist "%PY%" set PY=python
"%PY%" "%~dp0frontend\scripts\sprites\gerar_comfy.py" %*
pause

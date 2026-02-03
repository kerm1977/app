@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    BUSCANDO JAVA (VERSION FINAL - SIN MEMORIA)
echo ==========================================

set "JAVA_HOME="
set "DETECTED_VER=0"

:: --- 1. INTENTO POR SISTEMA ---
for /f "delims=" %%i in ('where javac 2^>nul') do set "SYSTEM_JAVAC=%%i"

if defined SYSTEM_JAVAC (
    for %%F in ("!SYSTEM_JAVAC!\..\..") do set "JAVA_HOME=%%~fF"
    echo [AUTO] Encontrado en PATH: !JAVA_HOME!
    goto :VERIFY_VERSION
)

:: --- 2. BUSQUEDA MANUAL ---
set "LOCATIONS="C:\Program Files\Microsoft" "C:\Program Files\Java" "C:\Program Files\Eclipse Adoptium""
set "VERSIONS=25 24 21 17"

if not defined JAVA_HOME (
    for %%L in (%LOCATIONS%) do (
        for %%V in (%VERSIONS%) do (
            if not defined JAVA_HOME (
                for /d %%D in ("%%~L\jdk-%%V*") do (
                    if exist "%%~fD\bin\javac.exe" set "JAVA_HOME=%%~fD"
                )
            )
        )
    )
)

:VERIFY_VERSION
if not defined JAVA_HOME (
    echo.
    echo [ERROR] No encontre Java.
    echo Asegurate de que la instalacion de Java 25 finalizo correctamente.
    pause
    exit
)

set PATH=%JAVA_HOME%\bin;%PATH%

for /f "tokens=3" %%g in ('java -version 2^>^&1 ^| findstr "version"') do set "JAVA_VER_RAW=%%g"
set "JAVA_VER_RAW=!JAVA_VER_RAW:"=!"
for /f "delims=." %%v in ("!JAVA_VER_RAW!") do set "DETECTED_VER=%%v"

echo [OK] Ruta: %JAVA_HOME%
echo [OK] Version detectada: %DETECTED_VER%
echo.

:: --- AUTO-PARCHE ---
if %DETECTED_VER% GTR 20 (
    echo [AUTO-FIX] Java %DETECTED_VER% es muy reciente.
    echo Ajustando proyecto para usar compatibilidad con Java 17...
    if exist variables.gradle (
        powershell -Command "(Get-Content variables.gradle) -replace 'javaVersion = 21', 'javaVersion = 17' | Set-Content variables.gradle"
    )
)

echo ==========================================
echo    LIMPIANDO MEMORIA VIEJA...
echo ==========================================
:: IMPORTANTE: Esto mata los procesos que recuerdan el Java 17 roto
call gradlew.bat --stop

echo ==========================================
echo    COCINANDO TU APP...
echo ==========================================

:: Agregamos --no-daemon para obligarlo a usar el entorno NUEVO
call gradlew.bat assembleDebug -Dorg.gradle.java.home="%JAVA_HOME%" --no-daemon

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo    ¡EXITO! TU APP ESTA LISTA
    echo ==========================================
    echo.
    echo Abriendo la carpeta con tu APK...
    explorer "app\build\outputs\apk\debug"
) else (
    echo.
    echo [ERROR] Fallo la compilacion.
)

pause
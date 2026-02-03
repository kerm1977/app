@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    BUSCANDO JAVA (PRIORIDAD: 17 LTS)
echo ==========================================

set "JAVA_HOME="
set "DETECTED_VER=0"

:: --- 1. BUSQUEDA PRIORITARIA ---
set "LOCATIONS="C:\Program Files\Eclipse Adoptium" "C:\Program Files\Java" "C:\Program Files\Microsoft""
set "STABLE_VERSIONS=17 21"

for %%V in (%STABLE_VERSIONS%) do (
    for %%L in (%LOCATIONS%) do (
        if not defined JAVA_HOME (
            for /d %%D in ("%%~L\jdk-%%V*") do (
                if exist "%%~fD\bin\javac.exe" (
                    set "JAVA_HOME=%%~fD"
                    echo [AUTO] Encontrado Java %%V: %%~fD
                    goto :VERIFY_VERSION
                )
            )
        )
    )
)

:: --- 2. FALLBACK SISTEMA ---
if not defined JAVA_HOME (
    for /f "delims=" %%i in ('where javac 2^>nul') do set "SYSTEM_JAVAC=%%i"
    if defined SYSTEM_JAVAC (
        for %%F in ("!SYSTEM_JAVAC!\..\..") do set "JAVA_HOME=%%~fF"
    )
)

:VERIFY_VERSION
if not defined JAVA_HOME (
    echo [ERROR] No se encontro Java 17.
    pause
    exit
)

set PATH=%JAVA_HOME%\bin;%PATH%
for /f "tokens=3" %%g in ('java -version 2^>^&1 ^| findstr "version"') do set "JAVA_VER_RAW=%%g"
set "JAVA_VER_RAW=!JAVA_VER_RAW:"=!"
for /f "delims=." %%v in ("!JAVA_VER_RAW!") do set "DETECTED_VER=%%v"

echo [OK] Usando Java %DETECTED_VER% en: %JAVA_HOME%

:: --- 3. REPARAR VARIABLES.GRADLE (SDK 35 / JAVA 17) ---
if exist variables.gradle (
    echo [CFG] Asegurando variables.gradle correcto...
    echo ext { > variables.gradle
    echo     minSdkVersion = 24 >> variables.gradle
    echo     compileSdkVersion = 35 >> variables.gradle
    echo     targetSdkVersion = 35 >> variables.gradle
    echo     javaVersion = 17 >> variables.gradle
    echo     androidxActivityVersion = '1.9.0' >> variables.gradle
    echo     androidxAppCompatVersion = '1.6.1' >> variables.gradle
    echo     androidxCoordinatorLayoutVersion = '1.2.0' >> variables.gradle
    echo     androidxCoreVersion = '1.13.1' >> variables.gradle
    echo     androidxFragmentVersion = '1.7.1' >> variables.gradle
    echo     coreSplashScreenVersion = '1.0.1' >> variables.gradle
    echo     androidxWebkitVersion = '1.11.0' >> variables.gradle
    echo     junitVersion = '4.13.2' >> variables.gradle
    echo     androidxJunitVersion = '1.1.5' >> variables.gradle
    echo     androidxEspressoCoreVersion = '3.5.1' >> variables.gradle
    echo     cordovaAndroidVersion = '13.0.0' >> variables.gradle
    echo } >> variables.gradle
)

:: --- 4. GENERAR SCRIPT DE FORZADO (FORCE_COMPAT.GRADLE) ---
:: Usamos escritura linea por linea para evitar errores de parentesis en Batch
echo [CFG] Creando script de anulacion de version Java y correccion Kotlin...

echo allprojects { > force_compat.gradle
echo     // 1. Forzar Java 17 en modulos >> force_compat.gradle
echo     afterEvaluate { project -^> >> force_compat.gradle
echo         if (project.hasProperty("android")) { >> force_compat.gradle
echo             android { >> force_compat.gradle
echo                 compileOptions { >> force_compat.gradle
echo                     sourceCompatibility = JavaVersion.VERSION_17 >> force_compat.gradle
echo                     targetCompatibility = JavaVersion.VERSION_17 >> force_compat.gradle
echo                 } >> force_compat.gradle
echo             } >> force_compat.gradle
echo         } >> force_compat.gradle
echo     } >> force_compat.gradle
echo     // 2. Corregir duplicados de clases Kotlin (Conflictos 1.6 vs 1.8) >> force_compat.gradle
echo     configurations.all { >> force_compat.gradle
echo         resolutionStrategy { >> force_compat.gradle
echo             force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22' >> force_compat.gradle
echo             force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22' >> force_compat.gradle
echo             force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22' >> force_compat.gradle
echo         } >> force_compat.gradle
echo     } >> force_compat.gradle
echo } >> force_compat.gradle

echo ==========================================
echo    LIMPIANDO DEMONIOS...
echo ==========================================
call gradlew.bat --stop

echo ==========================================
echo    COMPILANDO CON FORZADO DE JAVA 17...
echo ==========================================

:: AQUI ESTA LA CLAVE: --init-script force_compat.gradle
call gradlew.bat assembleDebug -Dorg.gradle.java.home="%JAVA_HOME%" --init-script force_compat.gradle --no-daemon

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo    EXITO TOTAL - APK CREADO
    echo ==========================================
    del force_compat.gradle
    explorer "app\build\outputs\apk\debug"
) else (
    echo.
    echo [ERROR] Fallo la compilacion.
)

pause
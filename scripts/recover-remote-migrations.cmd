@echo off
setlocal EnableExtensions

if "%SUPABASE_ACCESS_TOKEN%"=="" (
  echo Missing SUPABASE_ACCESS_TOKEN.
  echo In this CMD window, run: set SUPABASE_ACCESS_TOKEN=your_token_here
  exit /b 1
)

if "%SUPABASE_PROJECT_REF%"=="" set "SUPABASE_PROJECT_REF=jaixqnjgzsrzegbxfdot"
set "ATTENDA_MIGRATIONS_DIR=%~dp0..\supabase\migrations"
for %%I in ("%ATTENDA_MIGRATIONS_DIR%") do set "ATTENDA_MIGRATIONS_DIR=%%~fI"
set "ATTENDA_RECOVERY_DIR=%~dp0..\supabase\.temp\migration-recovery-%RANDOM%%RANDOM%"
for %%I in ("%ATTENDA_RECOVERY_DIR%") do set "ATTENDA_RECOVERY_DIR=%%~fI"

echo Backing up local migration files...
mkdir "%ATTENDA_RECOVERY_DIR%\local" 2>nul
robocopy "%ATTENDA_MIGRATIONS_DIR%" "%ATTENDA_RECOVERY_DIR%\local" *.sql /copy:DAT /r:1 /w:1 >nul
if errorlevel 8 goto :failed

echo Fetching remote migration files only...
call npx supabase migration fetch --project-ref %SUPABASE_PROJECT_REF% --yes
if errorlevel 1 goto :failed

echo Saving fetched remote migration files...
mkdir "%ATTENDA_RECOVERY_DIR%\remote" 2>nul
robocopy "%ATTENDA_MIGRATIONS_DIR%" "%ATTENDA_RECOVERY_DIR%\remote" *.sql /copy:DAT /r:1 /w:1 >nul
if errorlevel 8 goto :failed

echo Restoring your original local migration files...
robocopy "%ATTENDA_RECOVERY_DIR%\local" "%ATTENDA_MIGRATIONS_DIR%" *.sql /copy:DAT /r:1 /w:1 >nul
if errorlevel 8 goto :failed

echo Adding only remote migration files that were missing locally...
for %%F in ("%ATTENDA_RECOVERY_DIR%\remote\*.sql") do (
  if not exist "%ATTENDA_MIGRATIONS_DIR%\%%~nxF" copy /y "%%~fF" "%ATTENDA_MIGRATIONS_DIR%\%%~nxF" >nul
)

echo.
echo Recovery complete. No database migration was applied.
echo Local and fetched copies are saved under:
echo %ATTENDA_RECOVERY_DIR%
echo.
echo Next: run npx supabase migration list --project-ref %SUPABASE_PROJECT_REF%
exit /b 0

:failed
echo.
if exist "%ATTENDA_RECOVERY_DIR%\local" (
  echo Restoring your original local migration files...
  robocopy "%ATTENDA_RECOVERY_DIR%\local" "%ATTENDA_MIGRATIONS_DIR%" *.sql /copy:DAT /r:1 /w:1 >nul
)
echo Recovery stopped. Your original files are preserved under:
echo %ATTENDA_RECOVERY_DIR%\local
exit /b 1

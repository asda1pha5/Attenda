@echo off
setlocal
if "%SUPABASE_PROJECT_REF%"=="" set "SUPABASE_PROJECT_REF=jaixqnjgzsrzegbxfdot"
if "%SUPABASE_ACCESS_TOKEN%"=="" (
  echo Missing SUPABASE_ACCESS_TOKEN.
  echo Create a personal access token at https://supabase.com/dashboard/account/tokens
  echo Then run: set SUPABASE_ACCESS_TOKEN=your_token_here
  exit /b 1
)
echo Applying database migrations...
call npx supabase db push --project-ref %SUPABASE_PROJECT_REF%
if errorlevel 1 goto :failed
if not "%SUPPORT_TO_EMAIL%"=="" (
  echo Setting support inbox...
  call npx supabase secrets set SUPPORT_TO_EMAIL=%SUPPORT_TO_EMAIL% --project-ref %SUPABASE_PROJECT_REF%
  if errorlevel 1 goto :failed
)
echo Deploying Supabase functions...
call npx supabase functions deploy create-checkout-session --project-ref %SUPABASE_PROJECT_REF%
if errorlevel 1 goto :failed
call npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref %SUPABASE_PROJECT_REF%
if errorlevel 1 goto :failed
call npx supabase functions deploy notify-host --project-ref %SUPABASE_PROJECT_REF%
if errorlevel 1 goto :failed
call npx supabase functions deploy contact-support --no-verify-jwt --project-ref %SUPABASE_PROJECT_REF%
if errorlevel 1 goto :failed
call npx supabase functions deploy send-event-reminders --project-ref %SUPABASE_PROJECT_REF%
if errorlevel 1 goto :failed
echo Syncing Attendaa Auth email templates...
node scripts\sync-supabase-auth.mjs
if errorlevel 1 goto :failed
echo.
echo Supabase deployment complete.
exit /b 0
:failed
echo.
echo Deployment stopped. No later step was run after the error.
exit /b 1

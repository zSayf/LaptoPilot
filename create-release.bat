@echo off
REM Script to create a GitHub release for LaptoPilot

REM Variables
set REPO=zSayf/laptopilot
set TAG=v1.0.0
set RELEASE_NAME=LaptoPilot v1.0.0 - AI-Powered Laptop Recommendation Assistant
set RELEASE_NOTES_FILE=GITHUB_RELEASE.md

echo Creating GitHub release for %REPO% with tag %TAG%

REM Check if GitHub CLI is installed
gh --version >nul 2>&1
if %errorlevel% neq 0 (
    echo GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/
    echo Alternatively, you can create the release manually on GitHub:
    echo 1. Go to https://github.com/%REPO%/releases/new
    echo 2. Set Tag version to %TAG%
    echo 3. Set Release title to "%RELEASE_NAME%"
    echo 4. Copy the content of %RELEASE_NOTES_FILE% to the description
    echo 5. Upload the executable files from the release/ directory as assets
    echo 6. Publish the release
    pause
    exit /b 1
)

REM Create the release
echo Creating GitHub release...
gh release create "%TAG%" ^
    --repo "%REPO%" ^
    --title "%RELEASE_NAME%" ^
    --notes-file "%RELEASE_NOTES_FILE%" ^
    release/*.exe release/*.blockmap

if %errorlevel% equ 0 (
    echo Release created successfully!
) else (
    echo Failed to create release. Please check the error message above.
)

pause
#!/bin/bash

# Script to create a GitHub release for LaptoPilot

# Variables
REPO="zSayf/laptopilot"
TAG="v1.0.0"
RELEASE_NAME="LaptoPilot v1.0.0 - AI-Powered Laptop Recommendation Assistant"
RELEASE_NOTES_FILE="GITHUB_RELEASE.md"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null
then
    echo "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/"
    echo "Alternatively, you can create the release manually on GitHub:"
    echo "1. Go to https://github.com/$REPO/releases/new"
    echo "2. Set Tag version to $TAG"
    echo "3. Set Release title to '$RELEASE_NAME'"
    echo "4. Copy the content of $RELEASE_NOTES_FILE to the description"
    echo "5. Upload the executable files from the release/ directory as assets"
    echo "6. Publish the release"
    exit 1
fi

# Create the release
echo "Creating GitHub release..."
gh release create "$TAG" \
    --repo "$REPO" \
    --title "$RELEASE_NAME" \
    --notes-file "$RELEASE_NOTES_FILE" \
    release/*.exe release/*.blockmap

echo "Release created successfully!"
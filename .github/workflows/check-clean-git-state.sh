#!/bin/bash

# Check if git status is clean (no uncommitted changes)
if ! git diff --quiet --ignore-submodules HEAD; then
    echo "Error: Uncommitted changes detected in the repository"
    git status
    exit 1
fi

if ! git diff --quiet --cached --ignore-submodules HEAD; then
    echo "Error: Uncommitted staged changes detected in the repository"
    git status
    exit 1
fi

echo "Git status is clean"

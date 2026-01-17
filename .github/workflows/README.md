# GitHub Actions Workflows

This directory contains the GitHub Actions workflows for building and testing Void.

## Available Workflows

### 1. `build.yml` - Main Build Workflow
Builds the main Void application and runs tests.
- **Triggers**: Push to `master` branch, pull requests, manual dispatch
- **Jobs**:
  - `compile`: Compiles the project
  - `test-unit`: Runs unit tests on Linux
  - `test-browser`: Runs browser tests
  - `lint`: Runs ESLint and Stylelint
  - `hygiene`: Runs hygiene checks

### 2. `build-cli.yml` - CLI Build Workflow
Builds the Void CLI (written in Rust) on Linux.
- **Triggers**: Push to `master` branch, pull requests, manual dispatch
- **Jobs**:
  - `build-cli`: Builds and tests the CLI

### 2.5. `build-cli-matrix.yml` - CLI Multi-platform Build Workflow
Builds the Void CLI (written in Rust) on multiple platforms.
- **Triggers**: Push to `master` branch, pull requests, manual dispatch
- **Jobs**:
  - `build-cli`: Builds and tests the CLI on Ubuntu, macOS, and Windows

### 3. `build-extensions.yml` - Extensions Build Workflow
Builds the extensions.
- **Triggers**: Push to `master` branch, pull requests, manual dispatch
- **Jobs**:
  - `build-extensions`: Compiles all extensions

### 4. `build-web.yml` - Web Build Workflow
Builds the web version of Void.
- **Triggers**: Push to `master` branch, pull requests, manual dispatch
- **Jobs**:
  - `build-web`: Compiles the web version

### 5. `triage.yml` - Issue Triage Workflow
Automatically triages GitHub issues using AI.
- **Triggers**: Scheduled every 6 hours, manual dispatch
- **Jobs**:
  - `roadmap`: Updates the wiki with issue categories

### 6. `publish-artifacts.yml` - Publish Build Artifacts
Publishes build artifacts for distribution.
- **Triggers**: Manual dispatch, scheduled every Monday at midnight UTC
- **Jobs**:
  - `publish-artifacts`: Compiles all components and packages them for distribution

### 7. `codeql-analysis.yml` - CodeQL Analysis
Performs static code analysis using CodeQL.
- **Triggers**: Push to `master` branch, pull requests, scheduled every Monday at midnight UTC
- **Jobs**:
  - `analyze`: Analyzes the codebase for security and quality issues

## Running Workflows Manually

You can manually trigger any workflow by going to the GitHub Actions tab in your repository, selecting the workflow, and clicking "Run workflow".

## Caching

The workflows use GitHub Actions caching to speed up builds:
- Node.js dependencies are cached using `npm ci`
- Rust dependencies are cached for the CLI build
- Build artifacts are cached when possible

## Environment

All workflows run on Ubuntu 22.04 by default, with appropriate build tools installed.

## Dependencies

- Node.js version is specified in `.nvmrc`
- Rust toolchain is set to stable
- Build tools: `build-essential`, `pkg-config`, `libx11-dev`, `libx11-xcb-dev`, `libxkbfile-dev`, `libnotify-bin`, `libkrb5-dev`

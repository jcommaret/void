# Contributing to Void GitHub Actions Workflows

This document provides guidelines for contributing to the GitHub Actions workflows in the Void project.

## Workflow Structure

Each workflow file is located in the `.github/workflows/` directory and follows the standard GitHub Actions YAML format.

## Creating a New Workflow

To create a new workflow:

1. **Identify the purpose**: Determine what the workflow should accomplish (build, test, deploy, etc.)
2. **Choose a name**: Use descriptive names like `build.yml`, `test.yml`, `deploy.yml`
3. **Define triggers**: Specify when the workflow should run (push, pull_request, schedule, workflow_dispatch)
4. **Define jobs**: Break down the workflow into logical jobs
5. **Add documentation**: Update the `README.md` in the workflows directory

## Best Practices

### 1. Use Reusable Workflows

When possible, reuse common steps across workflows:

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4

  - name: Set up Node.js
    uses: actions/setup-node@v4
    with:
      node-version-file: '.nvmrc'
      cache: 'npm'
```

### 2. Use Matrix Strategy

For testing across multiple platforms or versions:

```yaml
strategy:
  matrix:
    os: [ubuntu-22.04, macos-12, windows-2022]
    node-version: [18, 20]
```

### 3. Cache Dependencies

Always cache dependencies to speed up builds:

```yaml
- name: Cache node_modules
  uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 4. Set Timeouts

Always set timeouts to prevent workflows from running indefinitely:

```yaml
runs-on: ubuntu-22.04
timeout-minutes: 60
```

### 5. Use Environment Variables

For sensitive data, use GitHub Secrets:

```yaml
env:
  API_KEY: ${{ secrets.API_KEY }}
```

### 6. Clean Up Artifacts

Remove unnecessary files to save storage:

```yaml
- name: Clean up
  run: |
    rm -rf node_modules
    rm -rf out
```

## Testing Workflows

Before committing a workflow:

1. **Test locally**: Use `act` (GitHub Actions runner) to test workflows locally
2. **Test in a branch**: Push to a feature branch and verify the workflow runs
3. **Check logs**: Review the workflow logs for any errors or warnings
4. **Verify artifacts**: If the workflow produces artifacts, verify they are correct

## Common Workflow Patterns

### Build Workflow

```yaml
name: Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - run: npm ci
      - run: npm run build
```

### Test Workflow

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - run: npm ci
      - run: npm test
```

### Deployment Workflow

```yaml
name: Deploy

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - run: npm ci
      - run: npm run build
      - name: Deploy to production
        run: ./deploy.sh
```

## Workflow Documentation

Each workflow should be documented in the `README.md` file in the workflows directory. Include:

- **Purpose**: What the workflow does
- **Triggers**: When it runs
- **Jobs**: What each job does
- **Artifacts**: Any artifacts produced
- **Dependencies**: Required secrets or environment variables

## Troubleshooting

### Workflow Not Triggering

1. Check the `on` section of the workflow
2. Verify the branch name matches
3. Check if the workflow is disabled in the repository settings

### Workflow Failing

1. Check the logs for error messages
2. Verify all dependencies are installed
3. Check for permission issues
4. Verify environment variables are set correctly

### Workflow Running Too Long

1. Check for infinite loops in the workflow
2. Verify all steps have timeouts
3. Check for hanging processes

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [act - Run GitHub Actions locally](https://github.com/nektos/act)

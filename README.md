
# createPr

## Brief Description

`createPr` is a command-line tool designed to streamline the process of creating pull requests by leveraging AI to generate descriptions based on Git diffs. It integrates with Azure DevOps and OpenAI to automate and enhance the pull request workflow, ensuring efficient and thorough documentation.

## Features

- Automatically fetches Git diffs and summarizes changes.
- Integrates with Azure DevOps to create pull requests.
- Utilizes OpenAI to generate meaningful PR titles and descriptions.
- Supports dry-run mode for testing without actual PR creation.
- Includes customizable PR templates.

## Installation

### Prerequisites

- Node.js and npm or yarn should be installed on your system.
- Ensure you have a valid Azure DevOps Personal Access Token and OpenAI API key.

### Steps

1. Clone the Repository:

   ```bash
   git clone https://github.com/yourusername/createPr.git
   cd createPr
   ```

2. Install Dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Link the CLI Tool Globally (optional):

   ```bash
   npm link
   ```

4. Append Repo to Environment Variables:
   Add the following to your environment variables:

   ```plaintext
   ORGANIZATION=your_organization
   PROJECT=your_project
   REPOSITORY_ID=your_repo_id
   PERSONAL_ACCESS_TOKEN=your_token
   OPENAI_API_KEY=your_openai_key
   ```

## Usage

### Basic Command

```bash
create-pr --title "Your PR Title" --description "Your PR Description"
```

### Using AI for Title and Description

Run the tool and let AI generate the title and description for you:

```bash
create-pr --dryRun
```

### Additional Options

- `--mock`: Runs in mock mode, generating placeholder data.
- `--dryRun`: Executes without actually creating the pull request.
- `--debug`: Enables debug mode for detailed logging.

## Configuration Options

Configurations can be set via CLI arguments or environment variables. For complete configuration, refer to `src/config.ts`.

## Contribution Guidelines

1. Fork the repository and clone it to your local machine.
2. Create a new branch for your feature or bugfix.
3. Follow our [CONVENTIONS.md](CONVENTIONS.md) for coding guidelines.
4. Write unit tests for your changes.
5. Submit a pull request with a detailed description of your changes.

## Testing Instructions

Run the test suite using:

```bash
npm test
```

Ensure all tests pass before submitting contributions.

## License

This project is licensed under the Apache License 2.0.

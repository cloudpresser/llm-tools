# CLI Tool: start-ai

## Installation

To install the dependencies, run:

```bash
npm install
# or
yarn install
```

### Global Installation

To link the CLI tool globally, run the following command in the root of your project:

```bash
npm link
```

This will create a symlink in your global `node_modules` directory, allowing you to use the `start-ai` command from anywhere.

### Environment Variables

Create a `.env` file in the root of your project to store environment variables. This file should contain the following variables:

```
API_KEY=your_api_key_here
ANOTHER_VARIABLE=another_value
```

Replace `your_api_key_here` and `another_value` with your actual values. The `.env` file is used to configure environment-specific settings and should not be committed to version control.

To link the CLI tool globally, run the following command in the root of your project:

```bash
npm link
```

This will create a symlink in your global `node_modules` directory, allowing you to use the `start-ai` command from anywhere.

## Usage

After linking the CLI tool globally, you can use the `start-ai` command as follows:

```bash
start-ai
```

This will execute the `start-ai` script and print "Starting AI..." to the console.

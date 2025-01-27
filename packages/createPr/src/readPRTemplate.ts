import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const neonBlue = chalk.hex('#00FFFF');
const neonPink = chalk.hex('#FF00FF');
const neonOrange = chalk.hex('#FFA500');

export async function readPRTemplate(cliPath: string): Promise<string> {
  const spinner = ora({
    text: neonBlue('Reading PR template...'),
    spinner: 'dots',
    color: 'cyan'
  }).start();

  try {
    // Get the directory where the package is installed
    const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    const templatePath = path.join(packageRoot, '/src/prTemplate.md');
    console.log('Template path:', templatePath);
    const template = await fs.readFile(templatePath, 'utf-8');
    spinner.succeed(neonPink('PR template read successfully.'));
    return template;
  } catch (error) {
    spinner.fail(neonOrange('Unable to read PR template. Using default template.'));
    return '## Summary:\n\n## Test Plan:\n\n## Review:';
  }
}

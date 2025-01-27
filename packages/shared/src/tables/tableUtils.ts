import chalk from 'chalk';
import { table, TableUserConfig } from 'table';

const neonBlue = chalk.hex('#00FFFF');

export function createTable(data: [string, string][] | string[][]): string {
  const config: TableUserConfig = {
    columns: {
      0: { alignment: 'right', width: 15 },
      1: { alignment: 'left', width: 50 },
    },
    columnDefault: {
      wrapWord: true,
    },
    border: {
      topBody: neonBlue('─'),
      topJoin: neonBlue('┬'),
      topLeft: neonBlue('┌'),
      topRight: neonBlue('┐'),
      bottomBody: neonBlue('─'),
      bottomJoin: neonBlue('┴'),
      bottomLeft: neonBlue('└'),
      bottomRight: neonBlue('┘'),
      bodyLeft: neonBlue('│'),
      bodyRight: neonBlue('│'),
      bodyJoin: neonBlue('│'),
      joinBody: neonBlue('─'),
      joinLeft: neonBlue('├'),
      joinRight: neonBlue('┤'),
      joinJoin: neonBlue('┼'),
    },
  };

  return table(data, config);
}

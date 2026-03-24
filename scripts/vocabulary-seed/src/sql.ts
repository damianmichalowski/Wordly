export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export function sqlHeader(commentLines: string[]): string {
  const lines = commentLines.map((l) => `-- ${l.replace(/\n/g, '\n-- ')}`);
  return `${lines.join('\n')}\n\nbegin;\n\n`;
}

export function sqlFooter(): string {
  return '\ncommit;\n';
}

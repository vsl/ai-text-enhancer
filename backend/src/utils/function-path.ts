export function getFunctionPath(pathname: string, functionName: string): string {
  const prefix = [`/functions/v1/${functionName}`, `/${functionName}`]
    .find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));

  return prefix ? pathname.slice(prefix.length) || '/' : pathname;
}

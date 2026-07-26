import type { Container } from "./container";
import { bootstrap } from "./bootstrap";

export function startServer(_container: Container): void {
  // TODO: mount module routes (modules/*) and listen on config.env.PORT.
  throw new Error("startServer: not implemented");
}


async function main(): Promise<void> {
  const container = await bootstrap();
  startServer(container);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

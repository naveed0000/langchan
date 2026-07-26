import { bootstrap } from "./bootstrap";
import { sendPrompt } from "../services/prompt.service";

async function main(): Promise<void> {
  const { model } = await bootstrap();
  await sendPrompt(model, "Introduce yourself in one short, friendly sentence. naveed");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

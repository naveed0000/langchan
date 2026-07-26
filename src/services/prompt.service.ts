import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { logInfo } from "../utils/logger";

export async function sendPrompt(model: BaseChatModel, promptText: string): Promise<string> {
  logInfo("Sending Prompt...");
  const response = await model.invoke([new HumanMessage(promptText)]);
  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  logInfo("Model Response");
  console.log(content);
  return content;
}

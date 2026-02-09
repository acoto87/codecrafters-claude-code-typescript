import OpenAI from "openai";
import fs from "fs";
import type { ChatCompletionMessageParam } from "openai/resources";
import { exec } from 'node:child_process';

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const messages: ChatCompletionMessageParam[] = [{ role: "user", content: prompt }];

  let stop = false;
  while (!stop) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: [
        {
          "type": "function",
          "function": {
            "name": "Read",
            "description": "Reads the content of a file given its path.",
            "parameters": {
              "type": "object",
              "properties": {
                "file_path": {
                  "type:": "string",
                  "description": "The path to the file to read."
                }
              },
              "required": ["file_path"]
            }
          }
        },
        {
          "type": "function",
          "function": {
            "name": "Write",
            "description": "Write content to a file",
            "parameters": {
              "type": "object",
              "required": ["file_path", "content"],
              "properties": {
                "file_path": {
                  "type": "string",
                  "description": "The path of the file to write to"
                },
                "content": {
                  "type": "string",
                  "description": "The content to write to the file"
                }
              }
            }
          }
        },
        {
          "type": "function",
          "function": {
            "name": "Bash",
            "description": "Execute a shell command",
            "parameters": {
              "type": "object",
              "required": ["command"],
              "properties": {
                "command": {
                  "type": "string",
                  "description": "The command to execute"
                }
              }
            }
          }
        }
      ]
    });

    const choices = response.choices;
    if (!choices || choices.length === 0) {
      throw new Error("no choices in response");
    }

    for (const choice of choices) {
      const message = choice.message;
      if (!message) {
        continue;
      }
      messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });
      if (message.tool_calls) {
        if (message.content) {
          console.error(message.content);
        }
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === "function") {
            const func = toolCall.function;
            if (func.name === "Read") {
              const args = JSON.parse(func.arguments);
              const filePath = args.file_path;
              if (filePath) {
                const content = await fs.promises.readFile(filePath, "utf-8");
                messages.push({ role: "tool", tool_call_id: toolCall.id, content });
              }
            } else if (func.name === "Write") {
              const args = JSON.parse(func.arguments);
              const filePath = args.file_path;
              const content = args.content;
              if (filePath && content) {
                await fs.promises.writeFile(filePath, content, "utf-8");
                messages.push({ role: "tool", tool_call_id: toolCall.id, content });
              }
            } else if (func.name === "Bash") {
              const args = JSON.parse(func.arguments);
              const command = args.command;
              if (command) {
                exec(command, (error: any, stdout: string, stderr: string) => {
                  let output = "";
                  if (error) {
                    output += error.message;
                  }
                  if (stderr) {
                    output += `Stderr: ${stderr}\n`;
                  }
                  output += `Stdout: ${stdout}\n`;
                  messages.push({ role: "tool", tool_call_id: toolCall.id, content: output });
                });
              }
            }
          }
        }
      } else if (message.content) {
        console.log(message.content);
        stop = true;
        break;
      }
      if (choice.finish_reason === "stop") {
        stop = true;
        break;
      }
    }
  }
}

main();

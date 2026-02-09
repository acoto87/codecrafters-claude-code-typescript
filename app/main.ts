import OpenAI from "openai";

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

  const response = await client.chat.completions.create({
	model: "anthropic/claude-haiku-4.5",
	messages: [{ role: "user", content: prompt }],
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
	  }
	]
  });

  const choices = response.choices;
  if (!choices || choices.length === 0) {
	throw new Error("no choices in response");
  }

  console.error("Logs from your program will appear here!");

  // You can use print statements as follows for debugging, they'll be visible when running tests.
  const message = choices.message;
  if (message) {
  	console.log(message.content);
  	
  	if (message.tool_calls && message.tool_calls.length > 0) {
  		const toolCall = message.tool_calls[0];
  		if (toolCall.type === "function") {
  			const func = toolCall.function;
 			if (func.name === "Read" && func.arguments) {
  				const args = JSON.parse(func.arguments);
  				const filePath = args.file_path;
  				if (filePath) {
  					const file = Bun.file(filePath);
  					const text = await file.text();
  					console.log(text);
  				}
  			}
  		}
  	}
  }
}

main();

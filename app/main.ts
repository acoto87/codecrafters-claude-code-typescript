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

  	const messages = [{ role: "user", content: prompt }];

  	while (true) {
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
	  			}
			]
  		});

  		const choices = response.choices;
  		if (!choices || choices.length === 0) {
			throw new Error("no choices in response");
  		}

  		console.error("Logs from your program will appear here!");

		if (choices[0].finish_reason === "stop") {
			break;
		}

		for (const choice of choices) {
			const message = choice.message;
			if (!message) continue;
			if (message.content) {
				console.log(message.content);
     			messages.push({
     				role: "user",
     				content: message.content
     			});
			} 
			if (message.tool_calls) {
				console.log(message.tool_calls);
  				for (const toolCall of message.tool_calls) {	
  					if (toolCall.type === "function") {
  						const func = toolCall.function;
 						if (func.name === "Read") {
  							const args = JSON.parse(func.arguments);
  							const filePath = args.file_path;
  							if (filePath) {
  								const file = Bun.file(filePath);
  								const text = await file.text();
  								messages.push({
  									role: "tool",
  									tool_call_id: toolCall.id,
  									content: text	
  								});
  							}
  						}
  					}
  				}		
			} else {
				break;
			}
  		}
  	}
}

main();

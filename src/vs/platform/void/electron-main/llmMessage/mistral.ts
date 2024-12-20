import { Mistral } from "@mistralai/mistralai";
import { _InternalSendLLMMessageFnType } from '../../common/llmMessageTypes.js';


interface MistralMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

interface MistralResponse {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
}


export const sendMistralMsg: _InternalSendLLMMessageFnType = async ({ messages, onText, onFinalMessage, onError, settingsOfProvider, modelName, _setAborter }) => {
	let fullText = '';

	try {
		const thisConfig = settingsOfProvider.mistral

		const mistral = new Mistral({
			apiKey: thisConfig.apiKey
		});

		const response = (await mistral.chat.complete({
			model: thisConfig.model,
			messages: messages.map((msg) => ({
				role: msg.role as MistralMessage["role"],
				content: msg.content,
			})),
			stream: false,
		})) as MistralResponse;

		if (response?.choices?.[0]?.message?.content) {
			const content = response.choices[0].message.content;
			onText({ newText: content, fullText: content });
			onFinalMessage({ fullText: content });
		} else {
			throw new Error("Invalid response from Mistral API");
		}
	} catch (error) {
		onError({
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

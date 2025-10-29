import { OpenAPIRoute, Str } from 'chanfana';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { type AppContext } from '../types';

export class NewRoute extends OpenAPIRoute {
	schema = {
		tags: ['LLM'],
		summary: 'Create a new chat, return it\'s ID',
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							message: Str({
								description: 'Initial message to start the chat with',
							}),
						}),
					},
				},
			},
		},
		responses: {
			'200': {
				description: 'Chat created successfully',
				content: {
					'application/json': {
						schema: z.object({
							chatId: Str({
								description: 'ID of the newly created chat',
							}),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();

		// Retrieve the validated body
		const { message } = data.body;

		const uuid = crypto.randomUUID();
		// Save an empty entry in the KV for our listing endpoint
		env.KV.put(uuid, "",{
			metadata:{
				// I only need some basic info to show in the preview,
				// plus this makes sure it doesn't exceed the 1024 byte limit 
				// because 100 * 4 (max bytes per utf8 char) is in fact less than 1024
				startText: message.slice(0,100),
			}
		});
		const hibernationDO = env.WEBSOCKET_HIBERNATION_SERVER.getByName(uuid);
		hibernationDO.submitUserMessage(message);

		return { chatId: uuid };
	}
}

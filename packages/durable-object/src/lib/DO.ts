import { DurableObject } from 'cloudflare:workers';
import { ModelMessage, streamText } from 'ai';
import { createWorkersAI, WorkersAI } from 'workers-ai-provider';

type WSMessage = {
  type: 'history'
  messages: ModelMessage[];
  currentMessage: string | null;
}|{ type: 'partial',
  message: string;
}| {
  type: 'end',
} | {
  type: 'error',
  error: 'already generating';
}| {
  type: 'user',
  message: string;
}|{
	type: 'userInfo';
	count: number;
}

type UserWSMessage = {
	type: 'message'
	content: string;
}

export class WebSocketHibernationServer extends DurableObject {
	// Keeps track of all WebSocket connections
	// When the DO hibernates, gets reconstructed in the constructor
	sessions: Map<WebSocket, { [key: string]: string }>;

	currentBuffer: string | null = null;

	sql: SqlStorage;

	workersAI: WorkersAI;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessions = new Map;

		// As part of constructing the Durable Object,
		// we wake up any hibernating WebSockets and
		// place them back in the `sessions` map.

		// Get all WebSocket connections from the DO
		this.ctx.getWebSockets().forEach(ws => {
			const attachment = ws.deserializeAttachment();
			if (attachment) {
				// If we previously attached state to our WebSocket,
				// let's add it to `sessions` map to restore the state of the connection.
				this.sessions.set(ws, { ...attachment });
			}
		});
		this.sql = ctx.storage.sql;

		const workersAI = createWorkersAI({ binding: this.env.AI });
		this.workersAI = workersAI;

		this.setupTable();
	}

	// DB ops
	setupTable() {
		this.sql.exec(`
		CREATE TABLE IF NOT EXISTS messages(
		sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
		message     TEXT NOT NULL,
		role       TEXT NOT NULL
		);
	`);
	}

	addMessage(role: 'user' | 'assistant' | 'system', message: string) {
		this.sql.exec(
			'INSERT INTO messages (message, role) VALUES (?, ?);',
			message,
			role,
		);
	}

	getMessageHistory(): ModelMessage[] {
		return this
			.sql.exec<{ message: string, role: 'user' | 'assistant' | 'system' }>(`SELECT message, role FROM messages ORDER BY sequence`)
			.toArray().map(row => ({
				content: row.message,
				role: row.role,
			}));
	}

	getHistory(): WSMessage {
		const history : WSMessage = {
			type: 'history',
			messages: this.getMessageHistory(),
			currentMessage: this.currentBuffer,
		};
		return history;
	}

	// WebSocket handlers

	async fetch(_request: Request): Promise<Response> {
		// Creates two ends of a WebSocket connection.
		const webSocketPair = new WebSocketPair;
		const [client, server] = Object.values(webSocketPair);

		// Calling `acceptWebSocket()` informs the runtime that this WebSocket is to begin terminating
		// request within the Durable Object. It has the effect of "accepting" the connection,
		// and allowing the WebSocket to send and receive messages.
		// Unlike `ws.accept()`, `this.ctx.acceptWebSocket(ws)` informs the Workers Runtime that the WebSocket
		// is "hibernatable", so the runtime does not need to pin this Durable Object to memory while
		// the connection is open. During periods of inactivity, the Durable Object can be evicted
		// from memory, but the WebSocket connection will remain open. If at some later point the
		// WebSocket receives a message, the runtime will recreate the Durable Object
		// (run the `constructor`) and deliver the message to the appropriate handler.
		this.ctx.acceptWebSocket(server);
		console.log('WebSocket connection accepted in DO');

		// Generate a random UUID for the session.
		const id = crypto.randomUUID();

		// Attach the session ID to the WebSocket connection and serialize it.
		// This is necessary to restore the state of the connection when the Durable Object wakes up.
		server.serializeAttachment({ id });

		// Add the WebSocket connection to the map of active sessions.
		this.sessions.set(server, { id });

		const history = this.getHistory();
		console.log('Sending history to client:', history);
		server.send(JSON.stringify(history));
		const userInfoMessage: WSMessage = {
			type: 'userInfo',
			count: this.sessions.size,
		};
		this.broadcastMessage(userInfoMessage);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		// Get the session associated with the WebSocket connection.

		if (this.currentBuffer != null) {
			const endMessage: WSMessage = {
				type: 'error',
				error: 'already generating',
			};
			ws.send(JSON.stringify(endMessage));
		}
		const userMessage: UserWSMessage = JSON.parse(message.toString());
		await this.submitUserMessage(userMessage.content);
	}

	async submitUserMessage(userMessage: string) {
		// Insert user message into the database
		this.addMessage('user', userMessage);

		// Retrieve current messages
		const currentMessages: ModelMessage[] = this.getMessageHistory();

		// Notify all ws about the new user message
		this.broadcastMessage({
			type: 'user',
			message: userMessage.toString(),
		});

		// Start generating the response
		const response = streamText({
			model: this.workersAI('@cf/meta/llama-3.1-8b-instruct-fp8', {
				max_tokens: 500,
				stream: true,
			}),
			messages: currentMessages,
		});

		// Send response in chunks
		this.currentBuffer = '';
		for await (const chunk of response.textStream) {
			this.currentBuffer += chunk;
			this.broadcastMessage({
				type: 'partial',
				message: chunk,
			});
		}

		this.broadcastMessage({
			type: 'end',
		});

		// Only save after complete generation
		this.sql.exec(
			'INSERT INTO messages (message, role) VALUES (?, ?);',
			this.currentBuffer,
			'assistant',
		);
		this.currentBuffer = null;
	}

	async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean) {
		// Broadcast updated user count to other clients
		this.sessions.delete(ws);
		this.broadcastMessage({
			type: 'userInfo',
			count: this.sessions.size,
		});
	}

	// Helpers
	broadcastMessage(wsMessage: WSMessage) {
		this.sessions.forEach((attachment, connectedWs) => {
			connectedWs.send(JSON.stringify(wsMessage));
		});
	}
}

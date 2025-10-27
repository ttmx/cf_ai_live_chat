import { DurableObject } from 'cloudflare:workers';
import { ModelMessage, streamText } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';

type WSMessage = {
  type: 'history'
  messages: ModelMessage[];
  currentMessage: string | null;
}|{
  type: 'partial',
  message: string;
}| {
  type: 'end',
} | {
  type: 'error',
  error: 'already generating';
}| {
  type: 'user',
  message: string;
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

		this.sql.exec(`
    CREATE TABLE IF NOT EXISTS messages(
    sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
    message     TEXT NOT NULL,
    role       TEXT NOT NULL
    );
  `);

		// Sets an application level auto response that does not wake hibernated WebSockets.
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	async fetch(request: Request): Promise<Response> {
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

		// Generate a random UUID for the session.
		const id = crypto.randomUUID();
		const previousMessages: ModelMessage[] = this
			.sql.exec<{ message: string, role: 'user' | 'assistant' | 'system' }>(`SELECT message, role FROM messages ORDER BY sequence`)
			.toArray().map(row => ({
				content: row.message,
				role: row.role,
			}));
		const history: WSMessage = {
			type: 'history',
			messages: previousMessages,
			currentMessage: this.currentBuffer,
		};
		server.send(JSON.stringify(history));

		// Attach the session ID to the WebSocket connection and serialize it.
		// This is necessary to restore the state of the connection when the Durable Object wakes up.
		server.serializeAttachment({ id });

		// Add the WebSocket connection to the map of active sessions.
		this.sessions.set(server, { id });

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
		// const session = this.sessions.get(ws)!;
		const workersAI = createWorkersAI({ binding: this.env.AI });

		// We won't do toolcalls so we can omit tool from TS type
		const previousMessages: ModelMessage[] = this
			.sql.exec<{ message: string, role: 'user' | 'assistant' | 'system' }>(`SELECT message, role FROM messages ORDER BY sequence`)
			.toArray().map(row => ({
				content: row.message,
				role: row.role,
			}));
		this.sql.exec(
			'INSERT INTO messages (message, role) VALUES (?, ?);',
			message.toString(),
			'user',
		);
		this.sessions.forEach((attachment, connectedWs) => {
			const userMessage: WSMessage = {
				type: 'user',
				message: message.toString(),
			};
			connectedWs.send(JSON.stringify(userMessage));
		});

		const response = streamText({
			model: workersAI('@cf/meta/llama-3.1-8b-instruct-fp8', {
				max_tokens: 500,
				stream: true,
			}),
			messages: previousMessages.concat({
				role: 'user',
				content: message.toString(),
			}),
		});

		this.currentBuffer = '';
		for await (const chunk of response.textStream) {
			this.currentBuffer += chunk;
			const message: WSMessage = {
				type: 'partial',
				message: chunk,
			};
			this.sessions.forEach((attachment, connectedWs) => {
				connectedWs.send(JSON.stringify(message));
			});
		}
		this.sql.exec(
			'INSERT INTO messages (message, role) VALUES (?, ?);',
			this.currentBuffer,
			'assistant',
		);
		this.sessions.forEach((attachment, connectedWs) => {
			const endMessage: WSMessage = {
				type: 'end',
			};
			connectedWs.send(JSON.stringify(endMessage));
		});
		this.currentBuffer = null;
		// Upon receiving a message from the client, the server replies with the same message, the session ID of the connection,
		// and the total number of connections with the "[Durable Object]: " prefix
		// ws.send(`[Durable Object] message: ${message}, from: ${session.id}, to: the initiating client. Total connections: ${this.sessions.size}`);

		// // Send a message to all WebSocket connections, loop over all the connected WebSockets.
		// this.sessions.forEach((attachment, connectedWs) => {
		// 	connectedWs.send(`[Durable Object] message: ${message}, from: ${session.id}, to: all clients. Total connections: ${this.sessions.size}`);
		// });

		// Send a message to all WebSocket connections except the connection (ws),
		// loop over all the connected WebSockets and filter out the connection (ws).
		// this.sessions.forEach((attachment, connectedWs) => {
		// 	if (connectedWs !== ws) {
		// 		connectedWs.send(`[Durable Object] message: ${message}, from: ${session.id}, to: all clients except the initiating client. Total connections: ${this.sessions.size}`);
		// 	}
		// });
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		// If the client closes the connection, the runtime will invoke the webSocketClose() handler.
		this.sessions.delete(ws);
		ws.close(code, 'Durable Object is closing WebSocket');
	}
}

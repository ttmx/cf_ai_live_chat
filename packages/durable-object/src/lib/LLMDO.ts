import { DurableObject } from 'cloudflare:workers';
import { ModelMessage, streamText } from 'ai';
import { createWorkersAI, WorkersAI } from 'workers-ai-provider';
import { Repo, type DocHandle } from '@automerge/automerge-repo';
import type { DocumentId, PeerId } from '@automerge/automerge-repo';
import { SqliteStorageAdapter } from './SqliteStorageAdapter';
import { ExternalWebsocketsNetworkAdapter } from './ExternalWebsocketNetworkAdapter';

type SharedDoc = {
	userInput: string;
};

export type WSMessage = {
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
}|{
	type: 'userInfo';
	count: number;
}| {
	type: 'automerge';
	data: ArrayBuffer;
}|{
	type: 'automergeInfo';
	peerId: PeerId;
	documentId: DocumentId;
}

type UserWSMessage = {
	type: 'message'
	content: string;
} | {
	type: 'automerge';
	data: ArrayBuffer;
}

// the `ai` package doesn't export the TextGenerationModels type
const modelName: Parameters<WorkersAI>[0] = '@cf/meta/llama-3.1-8b-instruct-fp8';
const maxTokens = 500;

export class WebSocketHibernationServer extends DurableObject {
	// Keeps track of all WebSocket connections
	// When the DO hibernates, gets reconstructed in the constructor
	sessions: Map<WebSocket, { peerId: PeerId, id: string }>;

	currentBuffer: string | null = null;

	sql: SqlStorage;

	workersAI: WorkersAI;

	// Automerge
	repo: Repo;

	networkAdapter: ExternalWebsocketsNetworkAdapter;

	sharedDocHandle: DocHandle<SharedDoc> | null = null;

	documentId: DocumentId | null = null;

	documentReady: Promise<void>;

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

		// Initialize Automerge repo
		const storageAdapter = new SqliteStorageAdapter(this.sql);
		this.networkAdapter = new ExternalWebsocketsNetworkAdapter(this.sessions);

		this.repo = new Repo({
			storage: storageAdapter,
			network: [this.networkAdapter],
			peerId: `server-${ctx.id.toString()}` as PeerId,
		});

		// Connect the network adapter
		this.networkAdapter.connect(
			`server-${ctx.id.toString()}` as PeerId,
			{ isEphemeral: false },
		);

		// Initialize or load the shared document
		this.documentReady = this.initializeSharedDocument();

		// Re-establish peer connections for any hibernated WebSockets
		this.reestablishPeerConnections();
	}

	reestablishPeerConnections() {
		// When waking from hibernation, we need to re-notify the network adapter
		// about existing WebSocket connections
		if (this.sessions.size > 0) {
			for (const [_ws, sessionData] of this.sessions.entries()) {
				if (sessionData.peerId) {
					// Re-emit peer-candidate to the repo so it knows about this peer
					this.networkAdapter.emit('peer-candidate', {
						peerId: sessionData.peerId as PeerId,
						peerMetadata: {},
					});
				}
			}
		}
	}

	async initializeSharedDocument() {
		// Try to load existing document ID from storage
		const storedDocId = await this.ctx.storage.get<string>('automerge-doc-id');

		if (storedDocId) {
			// Load existing document
			this.documentId = storedDocId as DocumentId;
			this.sharedDocHandle = await this.repo.find<SharedDoc>(this.documentId);
		} else {
			// Create new document
			this.sharedDocHandle = this.repo.create<SharedDoc>({ userInput: '' });
			this.documentId = this.sharedDocHandle.documentId;
			await this.ctx.storage.put('automerge-doc-id', this.documentId);
		}

		// Wait for document to be ready
		await this.sharedDocHandle.whenReady();
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
		// Wait for document to be initialized
		await this.documentReady;

		// Creates two ends of a WebSocket connection.
		const webSocketPair = new WebSocketPair;
		const [client, server] = Object.values(webSocketPair);

		// Accept websocket on DO
		this.ctx.acceptWebSocket(server);

		// Generate a random UUID for the session.
		const id = crypto.randomUUID();
		const peerId = `client-${id}` as PeerId;

		// Attach the session ID and peerId to the WebSocket connection and serialize it.
		// This is necessary to restore the state of the connection when the Durable Object wakes up.
		server.serializeAttachment({ id, peerId });

		// Add the WebSocket connection to the map of active sessions.
		this.sessions.set(server, { id, peerId });

		const history = this.getHistory();
		server.send(JSON.stringify(history));

		// Send peerId to client so they can use it for Automerge
		const peerIdMessage: WSMessage = {
			type: 'automergeInfo',
			peerId: peerId,
			documentId: this.documentId,
		};
		server.send(JSON.stringify(peerIdMessage));

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
		const session = this.sessions.get(ws);
		if (!session) return;

		// Hack to distinguish Automerge messages from normal chat messages
		// Automerge uses CBOR to be more efficient, and this is sent as a binary frame
		if (message instanceof ArrayBuffer) {
			this.networkAdapter.receiveMessage(new Uint8Array(message), session.peerId);
			return;
		}

		// Handle regular chat messages
		if (this.currentBuffer != null) {
			const endMessage: WSMessage = {
				type: 'error',
				error: 'already generating',
			};
			ws.send(JSON.stringify(endMessage));
			return;
		}

		const userMessage: UserWSMessage = JSON.parse(message);

		if (userMessage.type === 'message') {
			await this.submitUserMessage(userMessage.content);
		}
	}

	async submitUserMessage(userMessage: string) {
		// Insert user message into the database
		this.addMessage('user', userMessage);

		// Retrieve current messages
		const currentMessages = this.getMessageHistory();

		// Notify all ws about the new user message
		this.broadcastMessage({
			type: 'user',
			message: userMessage.toString(),
		});

		// Start generating the response
		const response = streamText({
			model: this.workersAI(modelName, {
				max_tokens: maxTokens,
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
		this.addMessage('assistant', this.currentBuffer);
		this.currentBuffer = null;
	}

	async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
		// Get session info before deleting
		const session = this.sessions.get(ws);
		const peerId = session?.peerId as PeerId;

		// Notify network adapter of disconnect
		if (peerId) {
			this.networkAdapter.handleDisconnect(peerId);
		}

		// Broadcast updated user count to other clients
		this.sessions.delete(ws);
		this.broadcastMessage({
			type: 'userInfo',
			count: this.sessions.size,
		});
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		const session = this.sessions.get(ws);
		const peerId = session?.peerId;
		console.error(`WebSocket error for peer ${peerId}:`, error);
	}

	// Helpers
	broadcastMessage(wsMessage: WSMessage) {
		this.sessions.forEach((attachment, connectedWs) => {
			connectedWs.send(JSON.stringify(wsMessage));
		});
	}
}

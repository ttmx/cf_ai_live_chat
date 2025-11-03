// Heavily inspired from
// https://github.com/automerge/automerge-repo/blob/main/packages/automerge-repo-network-websocket/src/WebSocketServerAdapter.ts
import {
	NetworkAdapter,
	type PeerMetadata,
	type PeerId,
	cbor as cborHelpers,
} from '@automerge/automerge-repo';
import type { FromClientMessage, FromServerMessage } from '@automerge/automerge-repo-network-websocket';
import { isJoinMessage } from '@automerge/automerge-repo-network-websocket/dist/messages';

const { encode, decode } = cborHelpers;

/**
 * Automerge network adapter for existing websocket
 */
export class ExternalWebsocketsNetworkAdapter extends NetworkAdapter {
	private sessions: Map<WebSocket, { peerId: PeerId }>;

	private ready = false;

	private readyResolver?: () => void;

	private readyPromise: Promise<void>;

	constructor(sessions: Map<WebSocket, { peerId: PeerId }>) {
		super();
		this.sessions = sessions;
		this.readyPromise = new Promise<void>(resolve => {
			this.readyResolver = resolve;
		});
	}

	connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
		this.peerId = peerId;
		this.peerMetadata = peerMetadata;
		this.ready = true;
		this.readyResolver?.();
	}

	isReady() {
		return this.ready;
	}

	whenReady() {
		return this.readyPromise;
	}

	disconnect() {
		this.ready = false;
	}

	send(message: FromServerMessage) {
		if (!('targetId' in message) || !message.targetId) {
			console.error('Message has no targetId', message);
			return;
		}

		const targetPeerId = message.targetId as PeerId;

		// Find the WebSocket for this peer, can't use .find because entries is an iterator
		let targetSocket: WebSocket | null = null;
		for (const [socket, data] of this.sessions.entries()) {
			if (data.peerId === targetPeerId) {
				targetSocket = socket;
				break;
			}
		}

		if (!targetSocket) {
			console.log(`Peer ${targetPeerId} not found in sessions`);
			return;
		}

		// Encode and send the message
		const encoded = encode(message);
		const buffer = encoded.buffer.slice(
			encoded.byteOffset,
			encoded.byteOffset + encoded.byteLength,
		) as ArrayBuffer;

		targetSocket.send(buffer);
	}

	/**
   * Called when a message is received from a client WebSocket
   */
	receiveMessage(messageBytes: Uint8Array, peerId: PeerId) {
		try {
			const message = decode(messageBytes) as FromClientMessage;

			// Handle join messages specially
			if (isJoinMessage(message)) {
				// Register this peer
				this.emit('peer-candidate', {
					peerId,
					peerMetadata: message.peerMetadata,
				});

				// Send back a peer message
				this.send({
					type: 'peer',
					senderId: this.peerId,
					peerMetadata: this.peerMetadata,
					targetId: peerId,
				});
			} else {
				this.emit('message', message);
			}
		} catch (e) {
			console.error('Error decoding automerge message:', e);
		}
	}

	/**
   * Called when a peer disconnects
   */
	handleDisconnect(peerId: PeerId) {
		this.emit('peer-disconnected', { peerId });
	}
}

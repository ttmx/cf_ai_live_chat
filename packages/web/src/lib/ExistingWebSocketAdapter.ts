// Heavily inspired from
// https://github.com/automerge/automerge-repo/blob/main/packages/automerge-repo-network-websocket/src/WebSocketClientAdapter.ts
import {
	cbor as cborHelpers,
	NetworkAdapter,
	type PeerId,
	type PeerMetadata,
} from '@automerge/automerge-repo';
import type { FromClientMessage, FromServerMessage } from '@automerge/automerge-repo-network-websocket';
import { isErrorMessage, isPeerMessage } from '@automerge/automerge-repo-network-websocket/dist/messages';

const { encode, decode } = cborHelpers;

/**
 * Network adapter for Automerge that uses an existing WebSocket connection
 * This allows us to multiplex Automerge sync messages with other application messages
 */
export class ExistingWebSocketAdapter extends NetworkAdapter {
	private socket: WebSocket;

	private ready = false;

	private readyResolver?: () => void;

	private readyPromise: Promise<void>;

	private peerConnectedResolver?: () => void;

	private peerConnectedPromise: Promise<void>;

	constructor(socket: WebSocket) {
		super();
		this.socket = socket;
		this.readyPromise = new Promise<void>(resolve => {
			this.readyResolver = resolve;
		});
		this.peerConnectedPromise = new Promise<void>(resolve => {
			this.peerConnectedResolver = resolve;
		});
	}

	connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
		this.peerId = peerId;
		this.peerMetadata = peerMetadata;
		this.ready = true;
		this.readyResolver?.();

		// Send join message
		this.send({
			type: 'join',
			senderId: peerId,
			peerMetadata: peerMetadata || {},
			supportedProtocolVersions: ['1'],
		});
	}

	isReady() {
		return this.ready;
	}

	whenReady() {
		return this.readyPromise;
	}

	whenPeerConnected() {
		return this.peerConnectedPromise;
	}

	disconnect() {
		this.ready = false;
	}

	send(message: FromClientMessage) {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.warn('WebSocket not ready, cannot send message');
			return;
		}

		// Encode the message
		const encoded = encode(message);

		this.socket.send(encoded);
	}

	receiveMessage(messageBytes: Uint8Array) {
		try {
			const message = decode(messageBytes) as FromServerMessage;

			console.log('ExistingWebSocketAdapter: receiving message', message);
			// Handle peer response
			if (isPeerMessage(message)) {
				this.peerConnectedResolver?.();

				this.emit('peer-candidate', {
					peerId: message.senderId,
					peerMetadata: message.peerMetadata,
				});
			} else if (isErrorMessage(message)) {
				console.error('Received error message from server:', message);
			} else {
				// Forward other messages to the repo
				this.emit('message', message);
			}
		} catch (e) {
			console.error('Error decoding automerge message:', e);
		}
	}
}

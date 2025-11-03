<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_BASE_URL } from '$env/static/public';
	import type { SharedDoc, WSMessage } from '$lib';
	import { Badge } from '$lib/components/ui/badge';
	import * as InputGroup from '$lib/components/ui/input-group';
	import { ExistingWebSocketAdapter } from '$lib/ExistingWebSocketAdapter';
	import { Repo, type DocHandle, type DocumentId, type PeerId } from '@automerge/automerge-repo';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import UserIcon from '@lucide/svelte/icons/user';
	import type { ModelMessage } from 'ai';
	import { onMount } from 'svelte';

	let { data } = $props();

	// History
	let messages:ModelMessage[] = $state(data.history.messages || []);

	// Current streaming message
	let currentMessage: string|null = $state(data.history.currentMessage || null);

	// Input
	let textboxValue = $state('');
	let textarea = $state<HTMLTextAreaElement| null>(null);

	// Automerge
	let repo: Repo | null = null;
	let adapter: ExistingWebSocketAdapter | null = null;
	let docHandle: DocHandle<SharedDoc> | null = null;
	let documentId: DocumentId | null = null;
	let assignedPeerId: PeerId | null = null;

	let socket : WebSocket;
	let currentUserCount: number |null = $state(null);

	onMount(() => {
		// substring to change http to ws and https to wss
		socket = new WebSocket(`ws${PUBLIC_BASE_URL.substring(4)}/ws?convoId=${page.params.convo_id}`);

		// Just standardize to arraybuffer like in the server
		socket.binaryType = 'arraybuffer';

		socket.onopen = () => {
			console.log('WebSocket connection established');
		};

		socket.onmessage = async event => {
			// Hack check if this is a binary frame to distinguish automerge messages
			if (event.data instanceof ArrayBuffer) {
				let bytes = new Uint8Array(event.data);
				adapter?.receiveMessage(bytes);
				return;
			}

			// Handle JSON messages
			const message: WSMessage = JSON.parse(event.data);
			if (message.type === 'history') {
				messages = message.messages;
				currentMessage = message.currentMessage;
			} else if (message.type === 'partial') {
				if (currentMessage === null) {
					currentMessage = '';
				}
				const modelMessage = message.message;
				currentMessage += modelMessage;
			} else if (message.type === 'end') {
				// Handle end of message if needed
				if (currentMessage !== null) messages.push({ role: 'assistant', content: currentMessage });
				currentMessage = null;
			} else if (message.type === 'user') {
				messages.push({ role: 'user', content: message.message });
			} else if (message.type === 'userInfo') {
				currentUserCount = message.count;
			} else if (message.type === 'automergeInfo') {
				assignedPeerId = message.peerId;

				// Now initialize Automerge client with the correct peerId
				const adapterInstance = new ExistingWebSocketAdapter(socket);

				// Create repo with the server-assigned peerId
				repo = new Repo({
					peerId: assignedPeerId,
					network: [adapterInstance],
				});
				adapter = adapterInstance;

				// Connect with the server-assigned peerId
				adapter.connect(assignedPeerId);

				// Connect to the shared document
				documentId = message.documentId;
				if (repo && adapter) {
					try {
						// Wait for the peer connection to be established
						await adapter.whenPeerConnected();

						const handle = await repo.find<SharedDoc>(documentId);
						docHandle = handle;

						// Subscribe to changes
						docHandle.on('change', ({ doc }) => {
							if (doc && doc.userInput !== undefined) {
								textboxValue = doc.userInput || '';
							}
						});

						// Wait for document to be ready
						await docHandle.whenReady();
						const doc = docHandle.doc();
						textboxValue = doc.userInput || '';

						console.log('Document connection setup complete');
					} catch (error) {
						console.error('Failed to connect to document:', error);
					// console.error('Error stack:', error.stack);
					}
				} else {
					console.error('Cannot connect to document: repo or adapter is null', { repo, adapter, assignedPeerId });
				}
			}
		};

		textarea?.focus();
		return () => {
			socket.close();
		};
	});

	function submitMessage() {
		let message = { type: 'message', content: textboxValue };
		socket.send(JSON.stringify(message));

		// Update the shared document
		if (docHandle) {
			docHandle.change(doc => {
				doc.userInput = '';
			});
		}
	}

	function handleInput(value: string) {
		textboxValue = value;

		// Update the shared Automerge document
		if (docHandle) {
			docHandle.change(doc => {
				doc.userInput = value;
			});
		} else {
			console.warn('docHandle is null, cannot update document');
		}
	}

</script>

<div class="inline-block">
	<Badge><UserIcon/> {currentUserCount} </Badge>
</div>
<div class="w-full h-full flex flex-col items-center justify-end p-8 pb-16">
	<div class="overflow-y-scroll w-full flex flex-col">
		{#each messages as msg, index (index)}
			{#if msg.role === 'user'}
				<div class="w-full max-w-2xl mb-4 p-4 rounded-lg bg-primary/10 border-primary/40 border-2 self-end text-primary">
					<p>{msg.content}</p>
				</div>
			{:else}
				<div class="w-full max-w-2xl mb-4 p-4 rounded-lg self-start">
					<SvelteMarkdown source={msg.content.toString()} />
				</div>
			{/if}
		{/each}
		{#if currentMessage !== null}
			<div class="w-full max-w-2xl mb-4 p-4 rounded-lg bg-gray-100 self-start">
				<SvelteMarkdown source={currentMessage.toString()} />
			</div>
		{/if}
	</div>
	<InputGroup.Root class="w-full max-w-2xl">
		<InputGroup.Textarea
			bind:ref={textarea}
			value={textboxValue}
			oninput={(e: Event) => handleInput((e.target as HTMLTextAreaElement).value)}
			onkeydown={e => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					submitMessage();
				}
			}}
			placeholder="Ask, Search or Chat..." />
		<InputGroup.Addon align="block-end">
			<InputGroup.Button
				variant="default"
				class="rounded-full ml-auto"
				size="icon-xs"
				onclick={submitMessage}
			>
				<SendHorizontalIcon />
				<span class="sr-only">Send</span>
			</InputGroup.Button>
		</InputGroup.Addon>
	</InputGroup.Root>
</div>

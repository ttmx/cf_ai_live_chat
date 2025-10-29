<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_BASE_URL } from '$env/static/public';
	import type { WSMessage } from '$lib';
	import { Badge } from '$lib/components/ui/badge';
	import * as InputGroup from '$lib/components/ui/input-group';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import UserIcon from '@lucide/svelte/icons/user';
	import type { ModelMessage } from 'ai';
	import { onMount } from 'svelte';

	let {data} = $props();

	let messages:ModelMessage[] = $state(data.history.messages || []);
	let currentMessage: string|null = $state(data.history.currentMessage || null);
	let textboxValue = $state('');
	let textarea: HTMLTextAreaElement| null = null;
	let socket : WebSocket;
	let currentUserCount: number |null = $state(null);
	onMount(() => {
		socket = new WebSocket(`ws://${PUBLIC_BASE_URL}/ws?convoId=${page.params.convo_id}`);

		socket.onopen = () => {
			console.log('WebSocket connection established');
		};

		socket.onmessage = event => {
			const message: WSMessage = JSON.parse(event.data);
			if (message.type === 'history') {
				messages = message.messages
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
			}
		};

		textarea?.focus();
		return () => {
			socket.close();
		};
	});

	function submitMessage() {
		let message = { type: 'userInput', content: textboxValue };
		socket.send(JSON.stringify(message));
		textboxValue = '';
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
			bind:value={textboxValue}
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

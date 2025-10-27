<script lang="ts">
	import type { WSMessage } from '$lib';
	import * as InputGroup from '$lib/components/ui/input-group';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import { page } from '$app/state';
	import type { ModelMessage } from 'ai';
	import { onMount } from 'svelte';
	const messages:ModelMessage[] = $state([]);
	let currentMessage: string|null = $state(null);
	let { data } = $props();
  let textboxValue: string = $state('')
  let socket : WebSocket;
	onMount(() => {
		console.log('WebSocket Address:', data.wsAddress + '?convoId=' + page.params.convo_id);
		socket = new WebSocket(data.wsAddress + '?convoId=' + page.params.convo_id);

    socket.onopen = () => {
      console.log('WebSocket connection established');
    };
		socket.onmessage = event => {
			const message: WSMessage = JSON.parse(event.data);
			if (message.type === 'history') {
				message.messages
					.map(msg => {
						messages.push(msg);
					});
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
			}
		};
    return () => {
      socket.close();
    };
	});

  function submitMessage() {
    socket.send(textboxValue);
    textboxValue = '';
  }
</script>

<div class="w-full h-full flex flex-col items-center justify-end p-8 pb-16">
	{#each messages as msg, index (index)}
    {#if msg.role === 'user'}
      <div class="w-full max-w-2xl mb-4 p-4 rounded-lg bg-primary/10 border-primary/40 border-2 self-end text-primary">
        <p>{msg.content}</p>
      </div>
    {:else}
      <div class="w-full max-w-2xl mb-4 p-4 rounded-lg self-start">
        <p>{msg.content}</p>
      </div>
    {/if}
	{/each}
	{#if currentMessage !== null}
		<div class="w-full max-w-2xl mb-4 p-4 rounded-lg bg-gray-100 self-start">
			<p>{currentMessage}</p>
		</div>
	{/if}
	<InputGroup.Root class="w-full max-w-2xl">
		<InputGroup.Textarea
    bind:value={textboxValue}
    onkeydown={(e) => {
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

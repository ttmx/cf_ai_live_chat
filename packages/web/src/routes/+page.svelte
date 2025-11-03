<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PUBLIC_BASE_URL } from '$env/static/public';
	import * as InputGroup from '$lib/components/ui/input-group';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import { onMount } from 'svelte';

	let textareaValue = $state('');
	let textarea: HTMLTextAreaElement| null = null;

	async function submitFirstMessage() {
		if (textareaValue.trim() === '') return;
		let result = await fetch(`${PUBLIC_BASE_URL}/new`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ message: textareaValue }),
		});
		const uuidResult: { chatId: string } = await result.json();

		goto(resolve(`/${uuidResult.chatId}`));
	}

	onMount(() => {
		textarea?.focus();
	});

</script>

<div class="w-full h-full flex flex-col items-center justify-center p-8 gap-4">
	<div class="text-foreground"></div>
	<div class="text-center max-w-2xl space-y-3">
		<h1 class="text-3xl font-semibold tracking-tight">Collaborative AI Chat</h1>
		<p class="text-muted-foreground text-sm leading-relaxed">
			Start a chat and then open that chat on two tabs (or computers)! Try editing your input text simultaneously or with a bad internet connection! You can read more about me in the README.md
		</p>
	</div>
	<InputGroup.Root class="w-full max-w-2xl">
		<InputGroup.Textarea
			bind:ref={textarea}
			onkeydown={e => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					submitFirstMessage();
				}
			}}
			bind:value={textareaValue} placeholder="Ask, Search or Chat..." />
		<InputGroup.Addon align="block-end">
			<InputGroup.Button
				variant="default"
				class="rounded-full ml-auto"
				size="icon-xs"
				onclick={submitFirstMessage}
			>
				<SendHorizontalIcon />
				<span class="sr-only">Send</span>
			</InputGroup.Button>
		</InputGroup.Addon>
	</InputGroup.Root>
</div>

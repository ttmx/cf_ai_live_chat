<script lang="ts">
	import '../app.css';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { page } from '$app/state';
    import { localChats } from '$lib/index.svelte';

	let { children, data } = $props();
	let chats = $derived(
		Array.from(
			new Map(
				localChats.concat(data.chats).map(chat => [
					chat.chatId,
					{
						title: chat.startText,
						url: `${chat.chatId}`,
					}
				])
			).values()
		)
	);
</script>

<Sidebar.Provider>
	<AppSidebar items={chats} />
	<main class="w-full">
		<Sidebar.Trigger />
		{#key page.url.pathname}
			{@render children?.()}
		{/key}
	</main>
</Sidebar.Provider>

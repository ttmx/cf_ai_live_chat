<script lang="ts">
	import '../app.css';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();
	let chats = data.chats.map(chat => ({
		title: chat.startText,
		url: `${chat.chatId}`,
	}));
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

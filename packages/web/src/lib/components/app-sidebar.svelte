<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	// Menu items.
	const items = [
		{
			title: 'Home',
			url: '#',
		},
		{
			title: 'Inbox',
			url: '#',
		},
		{
			title: 'Calendar',
			url: '#',
		},
		{
			title: 'Search',
			url: '#',
		},
		{
			title: 'Settings',
			url: '#',
		},
	];
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Hireinator 3000</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton>
							{#snippet child({ props })}
								<a href={resolve('/new')} {...props}>
									<span> + New Chat</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Previous chats</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each items as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<a href={resolve('/[convo_id]', { convo_id: item.url })} {...props}>
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{:else}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<span {...props}> No chats yet</span>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>

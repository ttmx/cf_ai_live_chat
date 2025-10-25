<script lang="ts">
	import * as InputGroup from '$lib/components/ui/input-group';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
</script>

<div class="w-full h-full flex flex-col items-center justify-center p-8">
	<InputGroup.Root class="w-full max-w-2xl">
		<InputGroup.Textarea placeholder="Ask, Search or Chat..." />
		<InputGroup.Addon align="block-end">
			<InputGroup.Button
				variant="outline"
				class="rounded-full"
				size="icon-xs"
			>
				<PlusIcon />
			</InputGroup.Button>
			<InputGroup.Button
				variant="default"
				class="rounded-full ml-auto"
				size="icon-xs"
			>
				<SendHorizontalIcon />
				<span class="sr-only">Send</span>
			</InputGroup.Button>
		</InputGroup.Addon>
	</InputGroup.Root>
</div>

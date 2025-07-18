<script lang="ts">
	import { toRelativeDate, toAmPm, getJalaliDateString, parseJalaliDate } from '$lib/date-utils';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { RefreshCw, Plus, Trash2, Package, Truck, Check } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	export let data: PageData;
	export let form: ActionData;
	let refreshing = false;
	let adding = false;
	let removing: number | null = null;

	$: {
		if (form?.toast) {
			toast[form.toast.type](form.toast.message);
		}
	}

	function formatLastRefresh(isoString: string | null | undefined) {
		if (!isoString) return 'هرگز';
		const date = new Date(isoString);
		return new Intl.DateTimeFormat('fa-IR', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	function getStatusColor(stepNumber: number, totalSteps: number) {
		if (stepNumber === 1) return 'bg-green-500';
		if (stepNumber === totalSteps) return 'bg-blue-500';
		return 'bg-orange-500';
	}

	function getStatusIcon(description: string) {
		if (description.includes('تولید بارکد') || description.includes('تحویل مرسوله به پست')) {
			return Package;
		}
		if (description.includes('تحویل به گیرنده') || description.includes('تحویل شد')) {
			return Check;
		}
		return Truck;
	}
</script>

<svelte:head>
	<title>رهگیری مرسولات پستی</title>
</svelte:head>

<div dir="rtl" class="min-h-screen bg-gray-50 font-sans text-gray-900">
	<div class="container mx-auto p-4 sm:p-6 lg:p-8">
		<header
			class="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
		>
			<div class="flex items-center gap-3">
				<Package class="h-8 w-8 text-blue-600" />
				<h1 class="text-2xl font-bold text-gray-800 sm:text-3xl">رهگیری مرسولات پستی</h1>
			</div>
			<div class="flex items-baseline gap-3">
				<p class="text-xs text-gray-500 sm:text-sm">
					آخرین بروزرسانی: {formatLastRefresh(data.lastRefresh)}
				</p>
				<form
					method="POST"
					action="?/refresh"
					use:enhance={() => {
						refreshing = true;
						return async ({ result }) => {
							await invalidateAll();
							refreshing = false;
						};
					}}
				>
					<button
						type="submit"
						disabled={refreshing}
						class="flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						<RefreshCw class={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
						<span>{refreshing ? 'در حال بروزرسانی...' : 'بروزرسانی همه'}</span>
					</button>
				</form>
			</div>
		</header>

		<main class="grid grid-cols-1 gap-10 lg:grid-cols-3">
			<aside class="lg:col-span-1">
				<div class="sticky top-8 rounded-lg border bg-white p-6 shadow-sm">
					<h2 class="mb-4 text-xl font-semibold text-gray-800">افزودن مرسوله جدید</h2>
					<form
						method="POST"
						action="?/addDelivery"
						use:enhance={({ form: formEl }) => {
							adding = true;
							return async ({ result }) => {
								await invalidateAll();
								adding = false;
								if (result.type === 'success') {
									formEl.reset();
								}
							};
						}}
						class="space-y-4"
					>
						<div>
							<label for="name" class="mb-1 block text-sm font-medium text-gray-700"
								>نام مرسوله</label
							>
							<input
								type="text"
								name="name"
								id="name"
								required
								class="block w-full rounded-md border-gray-300 bg-transparent px-3 py-2 text-sm placeholder-gray-400 transition-colors focus:border-gray-500 focus:ring-0 focus:outline-none"
								placeholder="مثال: گوشی موبایل"
							/>
						</div>
						<div>
							<label for="trackingNumber" class="mb-1 block text-sm font-medium text-gray-700"
								>کد رهگیری</label
							>
							<input
								type="text"
								name="trackingNumber"
								id="trackingNumber"
								required
								class="block w-full rounded-md border-gray-300 bg-transparent px-3 py-2 text-sm placeholder-gray-400 transition-colors focus:border-gray-500 focus:ring-0 focus:outline-none"
								placeholder="کد رهگیری پستی"
							/>
						</div>
						<button
							type="submit"
							disabled={adding}
							class="flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							<Plus class={`h-4 w-4 ${adding ? 'animate-spin' : ''}`} />
							<span>{adding ? 'در حال افزودن...' : 'افزودن'}</span>
						</button>
						{#if form?.success === false && form?.type === 'addDelivery'}
							<p class="mt-2 text-sm text-red-600">{form.message}</p>
						{/if}
					</form>
				</div>
			</aside>

			<section class="space-y-6 lg:col-span-2">
				{#if data.deliveries.length === 0}
					<div
						class="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-100 text-center"
					>
						<p class="text-lg font-medium text-gray-600">هیچ مرسوله‌ای یافت نشد.</p>
						<p class="mt-1 text-sm text-gray-500">
							برای شروع، یک مرسوله جدید از فرم کناری اضافه کنید.
						</p>
					</div>
				{:else}
					{#each data.deliveries as delivery (delivery.id)}
						<div class="rounded-lg border-r-4 border-blue-400 bg-white shadow-sm">
							<div class="flex items-center justify-between border-b p-4 sm:p-6">
								<div class="flex items-baseline gap-2">
									<h3 class="text-lg font-semibold text-gray-800">{delivery.name}</h3>
									<p class="font-mono text-xs text-gray-500">({delivery.trackingNumber})</p>
								</div>
								<form
									method="POST"
									action="?/removeDelivery"
									use:enhance={() => {
										removing = delivery.id;
										return async ({ result }) => {
											await invalidateAll();
											removing = null;
										};
									}}
								>
									<input type="hidden" name="id" value={delivery.id} />
									<button
										type="submit"
										disabled={removing === delivery.id}
										class="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
										aria-label="حذف مرسوله"
									>
										<Trash2 class={`h-4 w-4 ${removing === delivery.id ? 'animate-spin' : ''}`} />
									</button>
								</form>
							</div>
							<div class="p-4 sm:p-6">
								{#if delivery.events.length > 0}
									<div class="space-y-4">
										{#each delivery.events as event (event.id)}
											<div class="flex items-start gap-4">
												<div class="flex flex-col items-center">
													<div
														class={`rounded-full p-2 text-white ${getStatusColor(event.stepNumber, delivery.events.length)}`}
													>
														{#if typeof getStatusIcon(event.description) === 'string'}
															<span class="text-sm font-bold"
																>{getStatusIcon(event.description)}</span
															>
														{:else}
															<svelte:component
																this={getStatusIcon(event.description)}
																class="h-4 w-4"
															/>
														{/if}
													</div>
													{#if event.stepNumber < delivery.events.length}
														<div class="mt-2 h-8 w-0.5 bg-gray-300"></div>
													{/if}
												</div>
												<div class="flex-1 pb-4">
													<div class="flex items-start justify-between">
														<div>
															<p class="mb-1 font-semibold text-gray-800">{event.description}</p>
															{#if event.location}
																<p class="mb-2 text-sm text-gray-600">{event.location}</p>
															{/if}
														</div>
														<div class="text-left">
															<p class="text-sm font-medium text-gray-700">
																{event.eventDate}
															</p>
															{#if event.eventTime}
																<p class="text-xs text-gray-500">
																	{toAmPm(event.eventTime)}
																</p>
															{/if}
														</div>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<div
										class="flex items-center gap-3 rounded-md bg-yellow-50 p-4 text-sm text-yellow-700"
									>
										<Package class="h-5 w-5 flex-shrink-0" />
										<span>هنوز اطلاعات رهگیری برای این مرسوله دریافت نشده است.</span>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</section>
		</main>
	</div>
</div>

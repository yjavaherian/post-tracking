import { db } from '$lib/server/db';
import { deliveries, events, meta } from '$lib/server/db/schema';
import { refreshAllTrackings, refreshTrackingForDelivery } from '$lib/server/api';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
	const lastRefreshRow = await db.query.meta.findFirst({ where: eq(meta.key, 'lastRefresh') });
	const lastRefresh = lastRefreshRow?.value ? new Date(lastRefreshRow.value) : null;

	// Auto-refresh if last refresh was more than 1 hour ago
	if (!lastRefresh || new Date().getTime() - lastRefresh.getTime() > 60 * 60 * 1000) {
		await refreshAllTrackings();
	}

	const allDeliveries = await db.query.deliveries.findMany({
		with: {
			events: {
				orderBy: (events, { desc }) => [desc(events.stepNumber)]
			}
		}
	});

	const updatedLastRefresh = await db.query.meta.findFirst({
		where: eq(meta.key, 'lastRefresh')
	});

	return {
		deliveries: allDeliveries,
		lastRefresh: updatedLastRefresh?.value
	};
};

export const actions: Actions = {
	addDelivery: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const trackingNumber = data.get('trackingNumber') as string;

		if (!name || !trackingNumber) {
			return fail(400, {
				type: 'addDelivery',
				success: false,
				message: 'نام و کد رهگیری الزامی است'
			});
		}

		// Basic validation for tracking number (should be numeric and reasonable length)
		if (!/^\d{10,24}$/.test(trackingNumber)) {
			return fail(400, {
				type: 'addDelivery',
				success: false,
				message: 'کد رهگیری باید عددی و بین ۱۰ تا ۲۴ رقم باشد'
			});
		}

		try {
			const newDelivery = await db.insert(deliveries).values({ name, trackingNumber }).returning();
			if (newDelivery[0]) {
				await refreshTrackingForDelivery(newDelivery[0].id, newDelivery[0].trackingNumber);
			}
		} catch (error) {
			// Likely a unique constraint violation on trackingNumber
			return fail(400, {
				type: 'addDelivery',
				success: false,
				message: 'کد رهگیری قبلا ثبت شده است'
			});
		}

		return { success: true, toast: { type: 'success', message: 'مرسوله با موفقیت اضافه شد' } };
	},

	removeDelivery: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;

		if (!id) {
			return fail(400, { success: false, message: 'شناسه مرسوله نامعتبر است' });
		}

		await db.delete(deliveries).where(eq(deliveries.id, Number(id)));

		return { success: true, toast: { type: 'success', message: 'مرسوله با موفقیت حذف شد' } };
	},

	refresh: async () => {
		try {
			await refreshAllTrackings();
			return { success: true, toast: { type: 'success', message: 'اطلاعات با موفقیت بروز شد' } };
		} catch (error) {
			return fail(500, {
				success: false,
				message: 'خطا در بروزرسانی اطلاعات',
				toast: { type: 'error', message: 'خطا در بروزرسانی اطلاعات' }
			});
		}
	}
};

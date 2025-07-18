import { events, deliveries, meta } from './db/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { parseJalaliDate } from '$lib/date-utils';
import * as cheerio from 'cheerio';

const TRACKING_URL = 'https://tracking.post.ir/';

interface TrackingEvent {
	stepNumber: number;
	eventDate: string;
	eventTime: string;
	description: string;
	location: string;
}

interface TrackingResult {
	trackingNumber: string;
	events: TrackingEvent[];
}

// Helper function to get form data from the initial page
async function getFormData(): Promise<{
	viewState: string;
	viewStateGenerator: string;
	eventValidation: string;
}> {
	const response = await fetch(TRACKING_URL, {
		method: 'GET',
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			Connection: 'keep-alive',
			'Upgrade-Insecure-Requests': '1'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch form data: ${response.status}`);
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	const viewState = $('#__VIEWSTATE').val() as string;
	const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() as string;
	const eventValidation = $('#__EVENTVALIDATION').val() as string;

	if (!viewState || !viewStateGenerator || !eventValidation) {
		throw new Error('Could not extract required form data');
	}

	return { viewState, viewStateGenerator, eventValidation };
}

// Helper function to parse tracking results from HTML
function parseTrackingResults(html: string): TrackingEvent[] {
	const $ = cheerio.load(html);
	const events: TrackingEvent[] = [];

	// Look for tracking information in the HTML
	// The structure shows events with step numbers, dates, times, descriptions, and locations
	$('.newrowdata').each((index, element) => {
		const $row = $(element);
		const $cells = $row.find('.newtddata');

		if ($cells.length >= 4) {
			const stepNumber = parseInt($cells.eq(0).text().trim());
			const description = $cells.eq(1).text().trim();
			const location = $cells.eq(2).text().trim();
			const time = $cells.eq(3).text().trim();

			// Get the date from the nearest header above this row
			let dateText = '';
			$row.prevAll('.row').each((i, headerRow) => {
				const $headerRow = $(headerRow);
				if ($headerRow.find('.newtdheader').length > 0) {
					dateText = $headerRow.find('.newtdheader').first().text().trim();
					return false; // Break the loop
				}
			});

			if (stepNumber && description && time) {
				events.push({
					stepNumber,
					eventDate: parseJalaliDate(dateText) || new Date().toISOString().split('T')[0],
					eventTime: time,
					description,
					location: location || ''
				});
			}
		}
	});

	return events.sort((a, b) => a.stepNumber - b.stepNumber); // Sort by step number ascending
}

async function fetchTrackingFromPost(trackingNumber: string): Promise<TrackingEvent[]> {
	try {
		// First, get the form data
		const { viewState, viewStateGenerator, eventValidation } = await getFormData();

		// Prepare the form data for POST request
		const formData = new URLSearchParams({
			__EVENTTARGET: 'btnSearch',
			__EVENTARGUMENT: '',
			__VIEWSTATE: viewState,
			__VIEWSTATEGENERATOR: viewStateGenerator,
			__VIEWSTATEENCRYPTED: '',
			__EVENTVALIDATION: eventValidation,
			txtbSearch: trackingNumber,
			txtVoteReason: '',
			txtVoteTel: ''
		});

		// Make the POST request
		const response = await fetch(TRACKING_URL, {
			method: 'POST',
			headers: {
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5',
				'Accept-Encoding': 'gzip, deflate, br, zstd',
				Referer: TRACKING_URL,
				'Content-Type': 'application/x-www-form-urlencoded',
				Origin: 'https://tracking.post.ir',
				Connection: 'keep-alive',
				'Upgrade-Insecure-Requests': '1'
			},
			body: formData.toString()
		});

		if (!response.ok) {
			console.error(
				`Post tracking request failed with status ${response.status}: ${response.statusText}`
			);
			return [];
		}

		const html = await response.text();

		// Check if there's an error message in the response
		const $ = cheerio.load(html);
		const errorMessage = $('.alert-danger, .alert-warning').text().trim();
		if (errorMessage && errorMessage.includes('یافت نشد')) {
			console.log(`No tracking data found for ${trackingNumber}`);
			return [];
		}

		return parseTrackingResults(html);
	} catch (error) {
		console.error('Failed to fetch tracking from post:', error);
		return [];
	}
}

export async function refreshTrackingForDelivery(deliveryId: number, trackingNumber: string) {
	const trackingData = await fetchTrackingFromPost(trackingNumber);

	// Clear old events for this delivery
	await db.delete(events).where(eq(events.deliveryId, deliveryId));

	if (trackingData.length === 0) {
		return;
	}

	const newEvents = trackingData.map((event) => ({
		deliveryId: deliveryId,
		eventDate: event.eventDate,
		eventTime: event.eventTime,
		stepNumber: event.stepNumber,
		description: event.description,
		location: event.location
	}));

	await db.insert(events).values(newEvents);
}

export async function refreshAllTrackings() {
	const allDeliveries = await db.select().from(deliveries);

	for (const delivery of allDeliveries) {
		await refreshTrackingForDelivery(delivery.id, delivery.trackingNumber);
	}

	await db
		.insert(meta)
		.values({ key: 'lastRefresh', value: new Date().toISOString() })
		.onConflictDoUpdate({ target: meta.key, set: { value: new Date().toISOString() } });
}

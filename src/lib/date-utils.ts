import jalaali from 'jalaali-js';

const PERSIAN_MONTHS = [
	'فروردین',
	'اردیبهشت',
	'خرداد',
	'تیر',
	'مرداد',
	'شهریور',
	'مهر',
	'آبان',
	'آذر',
	'دی',
	'بهمن',
	'اسفند'
];

const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export function toGregorian(jalaliDate: string): string {
	// input format is YYYY/MM/DD
	const [y, m, d] = jalaliDate.split('/').map(Number);
	const g = jalaali.toGregorian(y, m, d);
	// pad with zero
	const gMonth = g.gm < 10 ? `0${g.gm}` : g.gm;
	const gDay = g.gd < 10 ? `0${g.gd}` : g.gd;
	return `${g.gy}-${gMonth}-${gDay}`;
}

function getTodayJalali() {
	const today = new Date();
	return jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function getStartOfDay(date: Date): Date {
	const newDate = new Date(date);
	newDate.setHours(0, 0, 0, 0);
	return newDate;
}

export function toRelativeDate(dateString: string): string {
	const today = getStartOfDay(new Date());
	const targetDay = getStartOfDay(new Date(dateString));
	const diff = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

	if (diff === 0) {
		return 'امروز';
	}
	if (diff === 1) {
		return 'فردا';
	}
	if (diff === -1) {
		return 'دیروز';
	}

	const targetJalali = jalaali.toJalaali(
		targetDay.getFullYear(),
		targetDay.getMonth() + 1,
		targetDay.getDate()
	);

	const weekday = PERSIAN_WEEKDAYS[targetDay.getDay()];

	// For dates within a week, show weekday
	if (diff > 1 && diff <= 7) {
		return weekday;
	}
	if (diff < -1 && diff >= -7) {
		return weekday;
	}

	// For older dates, show full date
	return `${weekday}، ${targetJalali.jy}/${targetJalali.jm}/${targetJalali.jd}`;
}

export function toAmPm(time: string): string {
	// time is in "HH:mm:ss" format
	const [h, m] = time.split(':');
	let hour = parseInt(h, 10);
	const minute = parseInt(m, 10);
	const period = hour >= 12 ? 'ب.ظ' : 'ق.ظ';
	hour = hour % 12;
	hour = hour ? hour : 12; // the hour '0' should be '12'
	const minuteStr = minute < 10 ? `0${minute}` : minute;
	return `${hour}:${minuteStr} ${period}`;
}

export function getJalaliDateString(dateString: string): string {
	const date = new Date(dateString);
	const j = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
	return `${j.jy}/${j.jm}/${j.jd}`;
}

export function parseJalaliDate(jalaliDateString: string): string {
	// Parse Persian date formats like "پنجشنبه 26 تیر ماه 1404"
	const parts = jalaliDateString.trim().split(' ');

	// Try to extract day, month, year
	let day = '',
		month = '',
		year = '';

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];

		// Check for day number
		if (/^\d{1,2}$/.test(part)) {
			day = part.padStart(2, '0');
		}

		// Check for month name
		const monthIndex = PERSIAN_MONTHS.findIndex((m) => part.includes(m));
		if (monthIndex !== -1) {
			month = (monthIndex + 1).toString().padStart(2, '0');
		}

		// Check for year
		if (/^14\d{2}$/.test(part)) {
			year = part;
		}
	}

	if (day && month && year) {
		return toGregorian(`${year}/${month}/${day}`);
	}

	// Fallback to today's date
	return new Date().toISOString().split('T')[0];
}

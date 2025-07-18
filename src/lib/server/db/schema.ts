import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const meta = sqliteTable('meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const deliveries = sqliteTable('deliveries', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	trackingNumber: text('tracking_number').notNull().unique()
});

export const events = sqliteTable('events', {
	id: integer('id').primaryKey(),
	deliveryId: integer('delivery_id')
		.notNull()
		.references(() => deliveries.id, { onDelete: 'cascade' }),
	eventDate: text('event_date').notNull(),
	eventTime: text('event_time').notNull(),
	stepNumber: integer('step_number').notNull(),
	description: text('description').notNull(),
	location: text('location')
});

export const deliveriesRelations = relations(deliveries, ({ many }) => ({
	events: many(events)
}));

export const eventsRelations = relations(events, ({ one }) => ({
	delivery: one(deliveries, {
		fields: [events.deliveryId],
		references: [deliveries.id]
	})
}));

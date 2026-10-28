
import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const directionEnum = pgEnum("direction", ["long", "short"]);

export const statusEnum = pgEnum("trade_status", ["open", "closed"]);

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: text("user_id").notNull(),

  instrument: text("instrument").notNull(),

  direction: directionEnum("direction").notNull(),

  status: statusEnum("status").notNull().default("open"),

  entryPrice: numeric("entry_price", {
    precision: 28,
    scale: 10,
  }).notNull(),

  exitPrice: numeric("exit_price", {
    precision: 28,
    scale: 10,
  }),

  quantity: numeric("quantity", {
    precision: 28,
    scale: 10,
  }).notNull(),

  fees: numeric("fees", {
    precision: 28,
    scale: 10,
  }),

  stopLoss: numeric("stop_loss", {
    precision: 28,
    scale: 10,
  }),

  takeProfit: numeric("take_profit", {
    precision: 28,
    scale: 10,
  }),

  strategy: text("strategy"),

  notes: text("notes"),

  openedAt: timestamp("opened_at", {
    withTimezone: true,
  }).notNull(),

  closedAt: timestamp("closed_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),
});

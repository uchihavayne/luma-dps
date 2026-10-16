import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const shares = sqliteTable('shares', {
  id: text('id').primaryKey(), tokenHash: text('token_hash').notNull(), clientHash: text('client_hash').notNull(),
  recordHash: text('record_hash').notNull(), recordJson: text('record_json').notNull(), bytes: integer('bytes').notNull(),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
  anonymous: integer('anonymous').notNull(), ranked: integer('ranked').notNull(), scope: text('scope').notNull(),
  name: text('name').notNull(), className: text('class_name').notNull(), region: text('region').notNull(),
  server: text('server').notNull(), boss: text('boss').notNull(), difficulty: text('difficulty').notNull(),
  dps: real('dps').notNull(), damage: integer('damage').notNull(), duration: integer('duration').notNull(),
  visibility: text('visibility').notNull().default('public'), viewHash: text('view_hash'), combatPower: integer('combat_power'),
}, t => [
  uniqueIndex('share_retry').on(t.tokenHash, t.clientHash), index('share_expiry').on(t.expiresAt),
  index('ranking_dps').on(t.ranked, t.scope, t.dps, t.id), index('ranking_region').on(t.ranked, t.region, t.dps),
  index('ranking_boss').on(t.ranked, t.boss, t.dps), index('ranking_class').on(t.ranked, t.className, t.dps),
]);
export const quotas = sqliteTable('quotas', {
  bucket: text('bucket').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [index('quota_expiry').on(t.expiresAt)]);
export const teamRooms = sqliteTable('team_rooms', {
  id: text('id').primaryKey(), joinHash: text('join_hash').notNull(), hostHash: text('host_hash').notNull(),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [uniqueIndex('team_host').on(t.hostHash), index('team_expiry').on(t.expiresAt)]);
export const teamPeers = sqliteTable('team_peers', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull(), tokenHash: text('token_hash').notNull(),
  displayName: text('display_name').notNull(), className: text('class_name').notNull(),
  receivedAt: integer('received_at').notNull(), sequence: integer('sequence').notNull(),
  captureLive: integer('capture_live').notNull(), payload: text('payload').notNull(),
}, t => [uniqueIndex('team_peer_token').on(t.roomId, t.tokenHash), index('team_active_peers').on(t.roomId, t.receivedAt)]);

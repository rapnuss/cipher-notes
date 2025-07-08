import {pgTable, varchar, text, integer, unique, bigint, pgEnum, boolean} from 'drizzle-orm/pg-core'

export const subscriptionTypeEnum = pgEnum('subscription_type', ['free', 'plus', 'pro'])

export type SubscriptionType = (typeof subscriptionTypeEnum.enumValues)[number]

export const usersTbl = pgTable('users', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  email: varchar({length: 255}).unique().notNull(),
  login_code: varchar({length: 6}),
  login_code_created_at: bigint({mode: 'number'}),
  login_tries_left: integer().default(0).notNull(),
  created_at: bigint({mode: 'number'}).$default(Date.now).notNull(),
  updated_at: bigint({mode: 'number'}).$default(Date.now).$onUpdate(Date.now).notNull(),
  sync_token: varchar({length: 24}),
  confirm_code: varchar({length: 6}),
  confirm_code_created_at: bigint({mode: 'number'}),
  confirm_code_tries_left: integer().default(0).notNull(),
  // if new_email is set the, the login_code is used to verify the new email
  // and the confirm_code is used to verify the old email
  // together with confirm_code_created_at and confirm_code_tries_left.
  new_email: varchar({length: 255}),
  subscription: subscriptionTypeEnum('subscription').default('free').notNull(),
})

export const sessionsTbl = pgTable('sessions', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  user_id: integer()
    .references(() => usersTbl.id)
    .notNull(),
  access_token_hash: varchar({length: 64}).notNull(),
  access_token_salt: varchar({length: 32}).notNull(),
  created_at: bigint({mode: 'number'}).$default(Date.now).notNull(),
})

export const noteTypeEnum = pgEnum('note_type', ['note', 'todo', 'label'])

export const notesTbl = pgTable(
  'notes',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    user_id: integer()
      .references(() => usersTbl.id)
      .notNull(),
    clientside_id: varchar({length: 36}).notNull(),
    type: noteTypeEnum('type').default('note').notNull(),
    cipher_text: text(),
    iv: varchar({length: 16}),
    version: integer().default(1).notNull(),
    serverside_created_at: bigint({mode: 'number'}).$default(Date.now).notNull(),
    serverside_updated_at: bigint({mode: 'number'})
      .$default(Date.now)
      .$onUpdate(Date.now)
      .notNull(),
    clientside_created_at: bigint({mode: 'number'}).notNull(),
    clientside_updated_at: bigint({mode: 'number'}).notNull(),
    clientside_deleted_at: bigint({mode: 'number'}),
  },
  (t) => [unique('user_client_id').on(t.user_id, t.clientside_id)]
)

export const filesMetaTbl = pgTable(
  'files_meta',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    user_id: integer()
      .references(() => usersTbl.id)
      .notNull(),
    clientside_id: varchar({length: 36}).notNull(),
    blob_stored: boolean().default(false).notNull(),
    cipher_text: text(), // {title, ext, mime, labels, archived}
    iv: varchar({length: 16}),
    version: integer().default(1).notNull(),
    serverside_created_at: bigint({mode: 'number'}).$default(Date.now).notNull(),
    serverside_updated_at: bigint({mode: 'number'})
      .$default(Date.now)
      .$onUpdate(Date.now)
      .notNull(),
    clientside_created_at: bigint({mode: 'number'}).notNull(),
    clientside_updated_at: bigint({mode: 'number'}).notNull(),
    clientside_deleted_at: bigint({mode: 'number'}),
  },
  (t) => [unique('file_user_client_id').on(t.user_id, t.clientside_id)]
)

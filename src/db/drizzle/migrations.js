// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo
// SQL content inlined to avoid Metro bundler issues with .sql file imports.

import journal from './meta/_journal.json';

const m0000 = `CREATE TABLE \`buildings\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`save_id\` integer NOT NULL,
\t\`grid_x\` integer NOT NULL,
\t\`grid_y\` integer NOT NULL,
\t\`type\` text NOT NULL,
\t\`powered\` integer DEFAULT false NOT NULL,
\tFOREIGN KEY (\`save_id\`) REFERENCES \`saves\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`chronology\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`save_id\` integer NOT NULL,
\t\`year\` integer DEFAULT 1980 NOT NULL,
\t\`month\` integer DEFAULT 1 NOT NULL,
\t\`tick\` integer DEFAULT 0 NOT NULL,
\tFOREIGN KEY (\`save_id\`) REFERENCES \`saves\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`quotas\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`save_id\` integer NOT NULL,
\t\`type\` text DEFAULT 'food' NOT NULL,
\t\`target\` integer DEFAULT 500 NOT NULL,
\t\`current\` integer DEFAULT 0 NOT NULL,
\t\`deadline_year\` integer DEFAULT 1985 NOT NULL,
\tFOREIGN KEY (\`save_id\`) REFERENCES \`saves\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`resources\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`save_id\` integer NOT NULL,
\t\`money\` integer DEFAULT 2000 NOT NULL,
\t\`food\` integer DEFAULT 200 NOT NULL,
\t\`vodka\` integer DEFAULT 50 NOT NULL,
\t\`power\` integer DEFAULT 0 NOT NULL,
\t\`power_used\` integer DEFAULT 0 NOT NULL,
\t\`population\` integer DEFAULT 0 NOT NULL,
\tFOREIGN KEY (\`save_id\`) REFERENCES \`saves\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`saves\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`name\` text DEFAULT 'autosave' NOT NULL,
\t\`timestamp\` integer NOT NULL,
\t\`version\` text DEFAULT '1.0.0' NOT NULL,
\t\`game_state\` text
);
--> statement-breakpoint
CREATE TABLE \`settings\` (
\t\`key\` text PRIMARY KEY NOT NULL,
\t\`value\` text NOT NULL
);`;

export default {
  journal,
  migrations: {
    m0000
  }
}

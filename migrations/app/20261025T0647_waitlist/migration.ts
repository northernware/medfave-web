#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0dff9b84e976540f2ab92b9403dceb3cd9148ed16ea79d6c93c5b31a71ec08a5/contract';
import endContract from '../../snapshots/0dff9b84e976540f2ab92b9403dceb3cd9148ed16ea79d6c93c5b31a71ec08a5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/508d85bbb09bba252b8a43feafddb52f40d766c0f0722a34690e767a298a2b9d/contract';
import startContract from '../../snapshots/508d85bbb09bba252b8a43feafddb52f40d766c0f0722a34690e767a298a2b9d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'WaitlistEntry',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'WaitlistEntry_pkey' })],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WaitlistEntry',
        constraint: 'WaitlistEntry_email_key',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

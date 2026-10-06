#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1c31c0df9ae457fb95f8925d6faa51493b3781745f5db9c398ee3448f3034a16/contract';
import startContract from '../../snapshots/1c31c0df9ae457fb95f8925d6faa51493b3781745f5db9c398ee3448f3034a16/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c8dd5721f1d129ec771c3dbd61a476add1017444bbf49c8661eb9d8e83bf841c/contract';
import endContract from '../../snapshots/c8dd5721f1d129ec771c3dbd61a476add1017444bbf49c8661eb9d8e83bf841c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'PatientCondition',
        column: col('code', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'PatientCondition',
        column: col('resolvedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'PatientCondition',
        column: col('resolvedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

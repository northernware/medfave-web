#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/70db03074a2788f41483b72201b82a9a55687c094f312e00c4fdb0b12c7343c2/contract';
import endContract from '../../snapshots/70db03074a2788f41483b72201b82a9a55687c094f312e00c4fdb0b12c7343c2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c8dd5721f1d129ec771c3dbd61a476add1017444bbf49c8661eb9d8e83bf841c/contract';
import startContract from '../../snapshots/c8dd5721f1d129ec771c3dbd61a476add1017444bbf49c8661eb9d8e83bf841c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'PatientMedication',
        column: col('stoppedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'PatientMedication',
        column: col('stoppedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

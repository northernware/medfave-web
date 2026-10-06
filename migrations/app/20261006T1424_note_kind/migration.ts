#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/228bca9984e62f86efa14fbf5f3eabcbfef29a035a47af3a1eee8a7b139b12c0/contract';
import endContract from '../../snapshots/228bca9984e62f86efa14fbf5f3eabcbfef29a035a47af3a1eee8a7b139b12c0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/70db03074a2788f41483b72201b82a9a55687c094f312e00c4fdb0b12c7343c2/contract';
import startContract from '../../snapshots/70db03074a2788f41483b72201b82a9a55687c094f312e00c4fdb0b12c7343c2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('noteKind', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

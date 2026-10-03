#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/bb5b4857a5bcfff9b00d9217c175411a5b1b2a711c33b007fcf1eabac01cc9d1/contract';
import endContract from '../../snapshots/bb5b4857a5bcfff9b00d9217c175411a5b1b2a711c33b007fcf1eabac01cc9d1/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/db5065a364bcc03314531fde6adda919a531c985214eea7b0752035425cdd9be/contract';
import startContract from '../../snapshots/db5065a364bcc03314531fde6adda919a531c985214eea7b0752035425cdd9be/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Appointment',
        column: col('patientConfirmedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

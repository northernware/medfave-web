#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0a8de520290ab6063ac82c2d4dcccf42779030df40563dae5002f3dde0d1623a/contract';
import endContract from '../../snapshots/0a8de520290ab6063ac82c2d4dcccf42779030df40563dae5002f3dde0d1623a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/228bca9984e62f86efa14fbf5f3eabcbfef29a035a47af3a1eee8a7b139b12c0/contract';
import startContract from '../../snapshots/228bca9984e62f86efa14fbf5f3eabcbfef29a035a47af3a1eee8a7b139b12c0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addNativeEnumValue({
        schema: 'public',
        typeName: 'DocumentType',
        value: 'OUTPATIENT_CERTIFICATE',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

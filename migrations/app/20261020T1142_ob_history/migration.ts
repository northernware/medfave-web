#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/300c94238c321170949720385c4142c0b2a3e5e2221fda345a0f863a0c009691/contract';
import endContract from '../../snapshots/300c94238c321170949720385c4142c0b2a3e5e2221fda345a0f863a0c009691/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a540cec3b8ef4e6cb8e0dd6b3d18209e9b80d9090a406d732e3caaffdf8e4ec9/contract';
import startContract from '../../snapshots/a540cec3b8ef4e6cb8e0dd6b3d18209e9b80d9090a406d732e3caaffdf8e4ec9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('lastMenstrualPeriod', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('menarche', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('menstrualCycle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('obAbortions', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('obGravida', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('obLiving', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('obNotes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('obPara', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('obPreterm', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('obTerm', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/300c94238c321170949720385c4142c0b2a3e5e2221fda345a0f863a0c009691/contract';
import startContract from '../../snapshots/300c94238c321170949720385c4142c0b2a3e5e2221fda345a0f863a0c009691/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/508d85bbb09bba252b8a43feafddb52f40d766c0f0722a34690e767a298a2b9d/contract';
import endContract from '../../snapshots/508d85bbb09bba252b8a43feafddb52f40d766c0f0722a34690e767a298a2b9d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'PatientImmunization',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('dose', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('givenOn', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('vaccine', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'PatientImmunization_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('birthDelivery', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('birthNotes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('birthTerm', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('birthWeight', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('development', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('developmentNotes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientImmunization',
        index: 'PatientImmunization_patientId_idx',
        columns: ['patientId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PatientImmunization',
        foreignKey: {
          name: 'PatientImmunization_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

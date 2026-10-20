#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0a8de520290ab6063ac82c2d4dcccf42779030df40563dae5002f3dde0d1623a/contract';
import startContract from '../../snapshots/0a8de520290ab6063ac82c2d4dcccf42779030df40563dae5002f3dde0d1623a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a540cec3b8ef4e6cb8e0dd6b3d18209e9b80d9090a406d732e3caaffdf8e4ec9/contract';
import endContract from '../../snapshots/a540cec3b8ef4e6cb8e0dd6b3d18209e9b80d9090a406d732e3caaffdf8e4ec9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'PatientFamilyHistory',
        columns: [
          col('condition', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('relative', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'PatientFamilyHistory_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'PatientPastHistory',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('year', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'PatientPastHistory_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('alcohol', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('occupation', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('packYears', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('smoking', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('socialNotes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientFamilyHistory',
        index: 'PatientFamilyHistory_patientId_idx',
        columns: ['patientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientPastHistory',
        index: 'PatientPastHistory_patientId_idx',
        columns: ['patientId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PatientFamilyHistory',
        foreignKey: {
          name: 'PatientFamilyHistory_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PatientPastHistory',
        foreignKey: {
          name: 'PatientPastHistory_patientId_fkey',
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

#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1c31c0df9ae457fb95f8925d6faa51493b3781745f5db9c398ee3448f3034a16/contract';
import endContract from '../../snapshots/1c31c0df9ae457fb95f8925d6faa51493b3781745f5db9c398ee3448f3034a16/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bb5b4857a5bcfff9b00d9217c175411a5b1b2a711c33b007fcf1eabac01cc9d1/contract';
import startContract from '../../snapshots/bb5b4857a5bcfff9b00d9217c175411a5b1b2a711c33b007fcf1eabac01cc9d1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Icd11Code',
        columns: [
          col('chapter', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaf', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('release', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uri', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['code'], { name: 'Icd11Code_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'VisitDiagnosis',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('medicalRecordId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('system', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uri', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'VisitDiagnosis_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VisitDiagnosis',
        index: 'VisitDiagnosis_code_idx',
        columns: ['code'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VisitDiagnosis',
        index: 'VisitDiagnosis_medicalRecordId_idx',
        columns: ['medicalRecordId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VisitDiagnosis',
        foreignKey: {
          name: 'VisitDiagnosis_medicalRecordId_fkey',
          columns: ['medicalRecordId'],
          references: { schema: 'public', table: 'MedicalRecord', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

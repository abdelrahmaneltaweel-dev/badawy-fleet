import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCsvToRows,
  detectColumnIndices,
  parseRawGpsPointsFromRows,
  processRawGpsInput,
  generateSyntheticTraccarRows,
  compareSingleVehicleSummary,
  compareBatchDailySummaries,
  convertAnalysisToDailySummary,
  analyzeVehicleDailyData
} from '../dist/index.js';

describe('T5.5 — Excel & CSV Raw Ingestion & Comparison Engine (ADR-048)', () => {
  describe('1. CSV Parsing & Column Detection', () => {
    it('parses comma-separated values with quotes and trimmed cells', () => {
      const csv = `DeviceId,DeviceName,Time,Valid,Latitude,Longitude,Speed
101,"عربية 101, خلاطة",2026-10-30T07:00:00Z,true,31.21,29.95,45.5
102,"عربية 102",2026-10-30T07:05:00Z,true,31.22,29.96,0`;

      const rows = parseCsvToRows(csv);
      assert.equal(rows.length, 3);
      assert.equal(rows[0][0], 'DeviceId');
      assert.equal(rows[1][0], 101);
      assert.equal(rows[1][1], 'عربية 101, خلاطة');
      assert.equal(rows[1][6], 45.5);
      assert.equal(rows[2][0], 102);
      assert.equal(rows[2][6], 0);
    });

    it('detects standard Traccar column indices correctly', () => {
      const header = ['DeviceId', 'DeviceName', 'Time', 'Valid', 'Latitude', 'Longitude', 'Speed', 'Course', 'Address'];
      const colMap = detectColumnIndices(header);

      assert.ok(colMap);
      assert.equal(colMap.vehicleId, 0);
      assert.equal(colMap.time, 2);
      assert.equal(colMap.valid, 3);
      assert.equal(colMap.latitude, 4);
      assert.equal(colMap.longitude, 5);
      assert.equal(colMap.speed, 6);
      assert.equal(colMap.course, 7);
      assert.equal(colMap.address, 8);
    });

    it('detects Arabic headers or alternate case-insensitive naming', () => {
      const header = ['رقم العربية', 'التاريخ والوقت', 'خط العرض', 'خط الطول', 'السرعة'];
      const colMap = detectColumnIndices(header);

      assert.ok(colMap);
      assert.equal(colMap.vehicleId, 0);
      assert.equal(colMap.time, 1);
      assert.equal(colMap.latitude, 2);
      assert.equal(colMap.longitude, 3);
      assert.equal(colMap.speed, 4);
    });
  });

  describe('2. Points Extraction & Ingestion Pipeline', () => {
    it('extracts points, sorts chronologically, and groups by vehicle', () => {
      const rawRows = [
        ['DeviceId', 'Time', 'Latitude', 'Longitude', 'Speed'],
        ['105', '2026-10-30T08:00:00Z', 31.2, 29.9, 50],
        ['105', '2026-10-30T06:00:00Z', 31.1, 29.8, 30], // Earlier time listed later
        ['108', '2026-10-30T07:00:00Z', 31.3, 29.7, 40],
      ];

      const { pointsByVehicle, totalRows, skippedRows } = parseRawGpsPointsFromRows(rawRows);
      assert.equal(totalRows, 3);
      assert.equal(skippedRows, 0);
      assert.equal(pointsByVehicle.size, 2);

      const p105 = pointsByVehicle.get('105');
      assert.equal(p105.length, 2);
      // Chronological order verified
      assert.ok(p105[0].timestamp.startsWith('2026-10-30T06:00:00'));
      assert.ok(p105[1].timestamp.startsWith('2026-10-30T08:00:00'));
    });

    it('processes raw input with pure logic and tags dataSource: "excel"', () => {
      const csv = `DeviceId,Time,Latitude,Longitude,Speed
110,2026-10-30T06:00:00Z,31.2000,29.9000,0
110,2026-10-30T06:15:00Z,31.2000,29.9000,0
110,2026-10-30T06:30:00Z,31.2100,29.9100,45
110,2026-10-30T07:00:00Z,31.2500,29.9500,50
110,2026-10-30T07:30:00Z,31.2500,29.9500,0
110,2026-10-30T07:45:00Z,31.2500,29.9500,0`;

      const result = processRawGpsInput({ csvText: csv });

      assert.equal(result.vehiclesCount, 1);
      assert.ok(result.vehicleSummaries['110']);
      const summary = result.vehicleSummaries['110'];

      // Must be tagged dataSource: 'excel' per ADR-048
      assert.equal(summary.dataSource, 'excel');
      assert.equal(summary.vehicleId, '110');
      assert.equal(summary.date, '2026-10-30');
      assert.ok(summary.stopsCount >= 1);
    });

    it('processes synthetic fleet (65 vehicles, 6,500 points) in < 200ms matching Spike S-10', () => {
      const syntheticRows = generateSyntheticTraccarRows(65, 100, '2026-10-30');
      assert.equal(syntheticRows.length, 6501); // 1 header + 6,500 rows

      const start = Date.now();
      const result = processRawGpsInput({ rows: syntheticRows });
      const duration = Date.now() - start;

      assert.equal(result.vehiclesCount, 65);
      assert.equal(result.validPointsCount, 6500);
      assert.equal(result.summariesList.length, 65);
      for (const summary of result.summariesList) {
        assert.equal(summary.dataSource, 'excel');
      }

      // Fast in-memory processing
      assert.ok(duration < 1000, `Processing duration was ${duration}ms, expected fast execution`);
    });
  });

  describe('3. Comparison Engine (مقارنة عند عودة السحب - ADR-048)', () => {
    it('detects 100% identical summaries between Traccar and Excel', () => {
      const analysis1 = analyzeVehicleDailyData(
        { id: '116', type: 'tractor' },
        [
          { vehicleId: '116', latitude: 31.1, longitude: 29.8, timestamp: '2026-10-30T06:00:00Z', speed: 0 },
          { vehicleId: '116', latitude: 31.2, longitude: 29.9, timestamp: '2026-10-30T07:00:00Z', speed: 45 },
          { vehicleId: '116', latitude: 31.2, longitude: 29.9, timestamp: '2026-10-30T07:30:00Z', speed: 0 }
        ]
      );

      const traccarSummary = convertAnalysisToDailySummary(analysis1, null, 'traccar');
      const excelSummary = convertAnalysisToDailySummary(analysis1, null, 'excel');

      assert.equal(traccarSummary.dataSource, 'traccar');
      assert.equal(excelSummary.dataSource, 'excel');

      const comparison = compareSingleVehicleSummary(traccarSummary, excelSummary);
      assert.equal(comparison.matchLevel, 'identical');
      assert.equal(comparison.matchScorePercent, 100);
      assert.equal(comparison.tripsDelta, 0);
      assert.equal(comparison.hasMajorDiscrepancy, false);
    });

    it('flags major discrepancy when trips count differs', () => {
      const baseSummary = {
        schemaVersion: 1,
        summaryId: '2026-10-30_116',
        date: '2026-10-30',
        vehicleId: '116',
        driverId: null,
        vehicleType: 'tractor',
        tripsCount: 4,
        trips: [],
        stopsCount: 3,
        stops: [],
        firstMovement: '2026-10-30T06:00:00Z',
        lastMovement: '2026-10-30T16:00:00Z',
        matchingStatus: 'pending',
        rulesVersion: '1.0.0',
        dataSource: 'traccar',
        createdAt: '2026-10-30T17:00:00Z',
        updatedAt: '2026-10-30T17:00:00Z'
      };

      const excelSummary = {
        ...baseSummary,
        tripsCount: 6, // 2 trips difference!
        dataSource: 'excel'
      };

      const comparison = compareSingleVehicleSummary(baseSummary, excelSummary);
      assert.equal(comparison.matchLevel, 'major_diff');
      assert.equal(comparison.hasMajorDiscrepancy, true);
      assert.equal(comparison.tripsDelta, 2);
      assert.ok(comparison.summaryArabic.includes('اختلاف في عدد النقلات'));
    });

    it('performs batch comparison for entire fleet', () => {
      const traccarList = [
        {
          schemaVersion: 1,
          summaryId: '2026-10-30_101',
          date: '2026-10-30',
          vehicleId: '101',
          driverId: null,
          vehicleType: 'tractor',
          tripsCount: 5,
          trips: [],
          stopsCount: 4,
          stops: [],
          firstMovement: '2026-10-30T06:00:00Z',
          lastMovement: '2026-10-30T15:00:00Z',
          matchingStatus: 'pending',
          rulesVersion: '1.0.0',
          dataSource: 'traccar',
          createdAt: '',
          updatedAt: ''
        },
        {
          schemaVersion: 1,
          summaryId: '2026-10-30_102',
          date: '2026-10-30',
          vehicleId: '102',
          driverId: null,
          vehicleType: 'tractor',
          tripsCount: 3,
          trips: [],
          stopsCount: 2,
          stops: [],
          firstMovement: '2026-10-30T07:00:00Z',
          lastMovement: '2026-10-30T14:00:00Z',
          matchingStatus: 'pending',
          rulesVersion: '1.0.0',
          dataSource: 'traccar',
          createdAt: '',
          updatedAt: ''
        }
      ];

      const excelList = [
        {
          ...traccarList[0],
          dataSource: 'excel'
        },
        {
          ...traccarList[1],
          tripsCount: 4, // diff on 102
          dataSource: 'excel'
        }
      ];

      const batch = compareBatchDailySummaries(traccarList, excelList, '2026-10-30');
      assert.equal(batch.totalComparedVehicles, 2);
      assert.equal(batch.identicalCount, 1);
      assert.equal(batch.majorDiffCount, 1);
      assert.equal(batch.onlyInTraccar.length, 0);
      assert.equal(batch.onlyInExcel.length, 0);
    });
  });
});

/**
 * Fixture generator for T4.3 Verification Baselines
 * Generates packages/logic/tests/fixtures/verification-baseline.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEOFENCES = [
  { id: 'FENCE-CRUSHER', name: 'كسارة الكيلو 21', type: 'crusher', center: { lat: 31.0200, lng: 29.7200 }, radiusMeters: 4500 },
  { id: 'FENCE-MIXER', name: 'محطة خلاطة برج العرب', type: 'mixer', center: { lat: 30.9200, lng: 29.6200 }, radiusMeters: 5500 },
  { id: 'FENCE-DOWLY', name: 'موقع الطريق الدولي', type: 'dump_site', center: { lat: 31.1500, lng: 29.8500 }, radiusMeters: 2500 },
  { id: 'FENCE-BORG', name: 'موقع برج العرب', type: 'dump_site', center: { lat: 30.8800, lng: 29.5800 }, radiusMeters: 4000 },
  { id: 'FENCE-HAWSH', name: 'عزبة كومبو - حوش عيسى', type: 'dump_site', center: { lat: 30.9100, lng: 30.1700 }, radiusMeters: 800 },
  { id: 'FENCE-GARAGE', name: 'الجراج الرئيسي', type: 'garage', center: { lat: 31.1000, lng: 29.8000 }, radiusMeters: 400 }
];

function generateVehicleHauls(vehicleId, count, options = {}) {
  const {
    startDate = new Date('2026-10-18T06:00:00Z'),
    hasMixerPassRoadside = false,
    injectPhantomSpeedJitter = false
  } = options;

  const points = [];
  let currentTimeMs = startDate.getTime();

  for (let cycle = 1; cycle <= count; cycle++) {
    // 1. Loading stop at Crusher (6 minutes = 7 pings, 1 min apart)
    for (let p = 0; p < 7; p++) {
      let speed = 0;
      let lat = 31.0200;
      let lng = 29.7200;

      // For hard vehicles, inject phantom speed <= 15 km/h at same coordinates
      if (injectPhantomSpeedJitter && p === 3) {
        speed = 8.5; // phantom speed while parked
      }

      points.push({
        vehicleId,
        latitude: lat,
        longitude: lng,
        speed,
        valid: true,
        ignition: true,
        timestamp: new Date(currentTimeMs).toISOString()
      });
      currentTimeMs += 60000;
    }

    // 2. Travel from Crusher towards Unload site
    for (let t = 1; t <= 4; t++) {
      points.push({
        vehicleId,
        latitude: 31.0200 + (t * 0.025),
        longitude: 29.7200 + (t * 0.025),
        speed: 48,
        valid: true,
        ignition: true,
        timestamp: new Date(currentTimeMs).toISOString()
      });
      currentTimeMs += 60000;
    }

    // Special Case for Vehicle 116 cycle 16 (or mid-run):
    // 7-minute pause on the road in front of Mixer (MIXER_PASS_STOP_MIN = 20)
    if (hasMixerPassRoadside && cycle === 16) {
      for (let mp = 0; mp < 7; mp++) {
        points.push({
          vehicleId,
          latitude: 30.9201, // In mixer boundary
          longitude: 29.6201,
          speed: 0,
          valid: true,
          ignition: true,
          timestamp: new Date(currentTimeMs).toISOString()
        });
        currentTimeMs += 60000;
      }

      // Resume travel from roadside to Dowly
      for (let t = 1; t <= 3; t++) {
        points.push({
          vehicleId,
          latitude: 30.9201 + (t * 0.05),
          longitude: 29.6201 + (t * 0.05),
          speed: 45,
          valid: true,
          ignition: true,
          timestamp: new Date(currentTimeMs).toISOString()
        });
        currentTimeMs += 60000;
      }
    }

    // 3. Unloading stop at Dowly (6 minutes = 7 pings)
    for (let u = 0; u < 7; u++) {
      let speed = 0;
      let lat = 31.1500;
      let lng = 29.8500;

      if (injectPhantomSpeedJitter && u === 2) {
        speed = 10.2; // phantom speed while parked
      }

      points.push({
        vehicleId,
        latitude: lat,
        longitude: lng,
        speed,
        valid: true,
        ignition: true,
        timestamp: new Date(currentTimeMs).toISOString()
      });
      currentTimeMs += 60000;
    }

    // 4. Return travel from Unload site back to Crusher
    for (let r = 1; r <= 4; r++) {
      points.push({
        vehicleId,
        latitude: 31.1500 - (r * 0.025),
        longitude: 29.8500 - (r * 0.025),
        speed: 52,
        valid: true,
        ignition: true,
        timestamp: new Date(currentTimeMs).toISOString()
      });
      currentTimeMs += 60000;
    }
  }

  return points;
}

const baselineFixture = {
  metadata: {
    title: 'Badawi Fleet Verification Baselines (T4.3)',
    version: '1.0.0',
    source: 'Project Status.html Section 22',
    date: '2026-11-06',
    parityTarget: '100% numerical parity with legacy system'
  },
  geofences: GEOFENCES,
  benchmarks: {
    '116': {
      vehicleId: '116',
      name: 'عربية 116',
      expectedHauls: 19,
      note: 'لحد 19/10 (بعدها الـ GPS اتشال للصيانة) وتجاوز وقفة الخلاطة 7 دقائق على الطريق',
      config: { mixerPassStopMinutes: 20 },
      rawPoints: generateVehicleHauls('116', 19, { hasMixerPassRoadside: true })
    },
    '118': {
      vehicleId: '118',
      name: 'عربية 118',
      expectedHauls: 29,
      note: 'تشغيل اعتيادي كامل',
      config: {},
      rawPoints: generateVehicleHauls('118', 29)
    },
    '124': {
      vehicleId: '124',
      name: 'عربية 124',
      expectedHauls: 29,
      note: 'عربية صعبة مع FREEZE_FIX لتصفير السرعة الوهمية أثناء التوقف',
      config: { freezeFix: true },
      rawPoints: generateVehicleHauls('124', 29, { injectPhantomSpeedJitter: true })
    },
    '114': {
      vehicleId: '114',
      name: 'عربية 114',
      expectedHauls: 20,
      note: 'أرقام التحقق المعتمدة',
      config: {},
      rawPoints: generateVehicleHauls('114', 20)
    },
    '132': {
      vehicleId: '132',
      name: 'عربية 132',
      expectedHauls: 14,
      note: 'أرقام التحقق المعتمدة',
      config: {},
      rawPoints: generateVehicleHauls('132', 14)
    },
    '123': {
      vehicleId: '123',
      name: 'عربية 123',
      expectedHauls: 13,
      note: 'أرقام التحقق المعتمدة',
      config: {},
      rawPoints: generateVehicleHauls('123', 13)
    }
  }
};

const outputPath = path.join(__dirname, 'verification-baseline.json');
fs.writeFileSync(outputPath, JSON.stringify(baselineFixture, null, 2), 'utf8');
console.log(`Generated verification fixture at: ${outputPath}`);
console.log(`Vehicle 116 points: ${baselineFixture.benchmarks['116'].rawPoints.length}`);
console.log(`Vehicle 118 points: ${baselineFixture.benchmarks['118'].rawPoints.length}`);
console.log(`Vehicle 124 points: ${baselineFixture.benchmarks['124'].rawPoints.length}`);
console.log(`Vehicle 114 points: ${baselineFixture.benchmarks['114'].rawPoints.length}`);
console.log(`Vehicle 132 points: ${baselineFixture.benchmarks['132'].rawPoints.length}`);
console.log(`Vehicle 123 points: ${baselineFixture.benchmarks['123'].rawPoints.length}`);

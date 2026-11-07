#!/usr/bin/env node
/**
 * Badawi Fleet Platform - Ingestion Cron Worker (CLI)
 * Ref: ADR-004 (Firebase Spark Plan Quota Protection), ADR-005 (Actions Worker)
 * Ref: ADR-019 (GPS Issues Lifecycle), ADR-023 (Traccar 12M Window)
 * Ref: ADR-049 (Refresh Rate Write Guard)
 * 
 * Executed via GitHub Actions cron or manual workflow_dispatch.
 * Pulls GPS positions from Traccar, runs pure analysis, computes checksums,
 * and writes ONLY changed summaries to Firestore to preserve Spark's 20,000 write limit.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  TraccarClient,
  IngestionManager,
  InMemoryRepository,
  FirestoreRestRepository,
  getOperationalDateString
} from '../../packages/logic/dist/index.js';

// Helper to adapt Firebase Admin Firestore to IDataRepository
class AdminFirestoreRepositoryAdapter {
  constructor(firestore) {
    this.name = 'firebase-admin-firestore';
    this.db = firestore;
  }

  async get(collection, id) {
    const snap = await this.db.collection(collection).doc(id).get();
    if (!snap.exists) return null;
    return snap.data();
  }

  async list(collection) {
    const snap = await this.db.collection(collection).get();
    return snap.docs.map((d) => d.data());
  }

  async create(collection, id, data) {
    const ref = this.db.collection(collection).doc(id);
    await ref.set(data);
    return data;
  }

  async update(collection, id, data) {
    const ref = this.db.collection(collection).doc(id);
    await ref.set(data, { merge: true });
    return data;
  }

  async delete(collection, id) {
    await this.db.collection(collection).doc(id).delete();
    return true;
  }
}

async function main() {
  const startTs = Date.now();
  console.log('====================================================');
  console.log('🚀 منصة متابعة أسطول شركة أبناء بدوي للمقاولات');
  console.log('🔄 تشغيل الـ Ingestion Worker الآلي (GitHub Actions / Spark Protection)');
  console.log('====================================================\n');

  // 1. Parse arguments & environment
  const isDryRun = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
  const forceAllWrites = process.env.FORCE_ALL === 'true' || process.argv.includes('--force');

  const dateArg = process.argv.find((a) => a.startsWith('--date='));
  const targetDate = dateArg ? dateArg.split('=')[1] : (process.env.OPERATIONAL_DATE || getOperationalDateString(new Date()));

  console.log(`📅 يوم التشغيل المعتمد: [${targetDate}] (يبدأ 06:00 ص)`);
  console.log(`⚙️ وضع التشغيل: ${isDryRun ? '🔍 تجريبي (Dry Run - بلا كتابة)' : '💾 إنتاجي (Production)'}`);
  if (forceAllWrites) console.log('⚠️ تحذير: تم تفعيل تجاوز المقارنة (--force) وكتابة الكل.');

  // 2. Initialize Traccar Client
  const traccarUrl = process.env.TRACCAR_URL || 'http://localhost:8082';
  const traccarToken = process.env.TRACCAR_TOKEN;
  const traccarUser = process.env.TRACCAR_USER;
  const traccarPass = process.env.TRACCAR_PASS;

  console.log(`📡 الاتصال بسيرفر Traccar: [${traccarUrl}]`);
  const traccarClient = new TraccarClient({
    url: traccarUrl,
    token: traccarToken,
    username: traccarUser,
    password: traccarPass,
    speedUnit: 'knots',
    timeoutMs: 25000
  });

  // 3. Initialize Repository (Firebase Admin or In-Memory fallback)
  let repository;
  const saSecret = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();

  if (saSecret) {
    try {
      const sa = JSON.parse(saSecret);
      if (!getApps().length) {
        initializeApp({ credential: cert(sa) });
      }
      const db = getFirestore();
      repository = new AdminFirestoreRepositoryAdapter(db);
      console.log(`🔥 تم الاتصال بـ Firestore عبر Admin SDK [مشروع: ${sa.project_id}]`);
    } catch (err) {
      console.warn('⚠️ تعذر تهيئة Firebase Admin SDK:', err.message);
      repository = new InMemoryRepository();
    }
  } else {
    console.log('ℹ️ لم يتم ضبط FIREBASE_SERVICE_ACCOUNT. استخدام InMemoryRepository للعرض.');
    repository = new InMemoryRepository();
  }

  // 4. Resolve Target Vehicles
  let syncTargets = [];
  const customTargets = process.env.FLEET_TARGETS;

  if (customTargets) {
    try {
      syncTargets = JSON.parse(customTargets);
      console.log(`📋 تم تحميل قائمة مخصصة لـ [${syncTargets.length}] عربية.`);
    } catch {
      console.warn('⚠️ فشل قراءة FLEET_TARGETS كـ JSON.');
    }
  }

  if (syncTargets.length === 0) {
    try {
      console.log('🔍 استكشاف الأجهزة من Traccar...');
      const devices = await traccarClient.getDevices();
      syncTargets = devices.map((d) => {
        // Extract vehicle ID (e.g. from uniqueId or name "عربية 116" -> "116")
        const match = d.name.match(/\d+/) || d.uniqueId.match(/\d+/);
        const vehicleId = match ? match[0] : String(d.id);
        const isTractor = d.category === 'tractor' || d.name.includes('جرار') || d.name.includes('خلاطة');
        return {
          deviceId: d.id,
          vehicleId,
          vehicleType: isTractor ? 'tractor' : 'truck',
          name: d.name
        };
      });
      console.log(`✅ تم استكشاف [${syncTargets.length}] جهاز أسطول من Traccar.`);
    } catch (err) {
      console.warn('⚠️ تعذر سحب الأجهزة من Traccar:', err.message);
      // Fallback baseline for testing
      syncTargets = [
        { deviceId: 1, vehicleId: '116', vehicleType: 'tractor', name: 'عربية 116' },
        { deviceId: 2, vehicleId: '118', vehicleType: 'tractor', name: 'عربية 118' },
        { deviceId: 3, vehicleId: '124', vehicleType: 'tractor', name: 'عربية 124' }
      ];
      console.log(`ℹ️ استخدام قائمة تجريبية لـ [${syncTargets.length}] عربات.`);
    }
  }

  // 5. Execute Ingestion with Diff & Quota Protection
  const manager = new IngestionManager(traccarClient, repository);

  console.log(`\n⏳ جاري السحب والتحليل والمقارنة لـ [${syncTargets.length}] عربية...`);
  const result = await manager.runIngestion(syncTargets, {
    operationalDate: targetDate,
    forceAllWrites,
    dryRun: isDryRun,
    batchSize: 5,
    delayBetweenBatchesMs: 250
  });

  const { stats } = result;

  // 6. Output Summary Report
  console.log('\n====================================================');
  console.log('📊 تقرير أداء السحب والمزامنة (Ingestion Summary)');
  console.log('====================================================');
  console.log(`⏱️ زمن التنفيذ الكلي: ${stats.durationMs} ms (${(stats.durationMs / 1000).toFixed(2)} ثانية)`);
  console.log(`🚛 إجمالي العربيات: ${stats.vehiclesTotal}`);
  console.log(`✅ تم معالجتها بنجاح: ${stats.vehiclesProcessed}`);
  console.log(`✍️ كتابات نُفذت فعلياً: ${stats.writesExecuted} مستند`);
  console.log(`🛡️ كتابات تم توفيرها (لم تتغير): ${stats.writesSkipped} مستند`);
  console.log(`💰 نسبة التوفير في حصة الكتابة: ${stats.writesSavedPercent}%`);
  console.log(`🔋 المتبقي من ميزانية Spark اليومية (20k): ${stats.dailySparkBudgetRemaining.toLocaleString()} كتابة`);
  if (stats.issuesDetected > 0) {
    console.log(`⚠️ تم رصد مشاكل GPS: [${stats.issuesDetected}] مشكلة`);
  }
  if (result.dailySnapshot) {
    console.log(`📸 لقطة الأسطول المجمعة (Snapshot): [${result.dailySnapshot.snapshotId}] جاهزة (قراءة واحدة 1 Read للداشبورد)`);
  }
  console.log('====================================================\n');

  if (!result.ok && stats.errorsCount === stats.vehiclesTotal) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ خطأ فادح في الـ Worker:', err);
  process.exit(1);
});

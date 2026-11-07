/**
 * Badawi Fleet Platform - GPS Issue Direct Contact & Communication Helpers
 * Ref: ADR-011 (روابط wa.me فقط و tel: للسائق), ADR-019, Vision §2-ج
 */

import type { IssueContactInfo, IssueType } from './types.js';

/**
 * Normalizes an Egyptian phone number for WhatsApp international URLs (e.g. 01012345671 -> 201012345671).
 */
export function normalizeEgyptianPhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('20')) {
    return digits;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `20${digits}`;
  }
  return digits;
}

/**
 * Builds direct telephone call URL (ADR-011)
 */
export function buildTelUrl(phone: string): string {
  const clean = phone.replace(/[^0-9+]/g, '');
  return `tel:${clean}`;
}

/**
 * Generates clear, professional Arabic message for the driver tailored to the GPS issue type
 */
export function generateIssueWhatsAppMessage(params: {
  vehicleId: string;
  vehicleName?: string;
  driverName?: string;
  issueType: IssueType;
  offlineMinutes?: number;
  detectedAt?: string;
  locationName?: string;
}): string {
  const greeting = params.driverName ? `السلام عليكم يا كابتن ${params.driverName}` : 'السلام عليكم يا كابتن';
  const vehicleLabel = params.vehicleName || `عربية ${params.vehicleId}`;

  switch (params.issueType) {
    case 'offline': {
      const durationTxt = params.offlineMinutes && params.offlineMinutes > 0
        ? `منذ أكثر من ${params.offlineMinutes} دقيقة`
        : 'حالياً';
      return `${greeting}، تم رصد انقطاع إشارة جهاز الـ GPS الخاص بـ (${vehicleLabel}) ${durationTxt}. يرجى التحقق من فيشة الجهاز وتوصيلات الكهرباء وإفادتنا للتأكد من سلامة التتبع. شكراً لتعاونك.`;
    }

    case 'frozen_signal': {
      const durationTxt = params.offlineMinutes && params.offlineMinutes > 0
        ? `منذ قرابة ${params.offlineMinutes} دقيقة`
        : 'أثناء التشغيل';
      return `${greeting}، إشارة جهاز الـ GPS الخاص بـ (${vehicleLabel}) متجمدة في نفس الموقع ${durationTxt} رغم تشغيل المحرك. يرجى إعادة تشغيل مفتاح الكهرباء وفحص الجهاز وإبلاغنا فوراً.`;
    }

    case 'no_power': {
      return `${greeting}، تنبيه بانقطاع تغذية الكهرباء عن جهاز الـ GPS الخاص بـ (${vehicleLabel}). يرجى مراجعة وصلات البطارية والفيوز.`;
    }

    default: {
      return `${greeting}، يرجى التحقق من جهاز الـ GPS في (${vehicleLabel}) لوجود تنبيه بالنظام والمتابعة معنا.`;
    }
  }
}

/**
 * Builds WhatsApp wa.me direct link with encoded message (ADR-011)
 */
export function buildWhatsAppIssueUrl(phone: string, message: string): string {
  const internationalPhone = normalizeEgyptianPhoneNumber(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${internationalPhone}?text=${encodedText}`;
}

/**
 * Comprehensive contact bundle for a GPS issue
 */
export function getIssueContactInfo(params: {
  vehicleId: string;
  vehicleName?: string;
  driverName?: string;
  driverPhone?: string;
  issueType: IssueType;
  offlineMinutes?: number;
  detectedAt?: string;
  locationName?: string;
}): IssueContactInfo {
  const phone = params.driverPhone || '';
  const message = generateIssueWhatsAppMessage(params);

  return {
    driverName: params.driverName || 'سائق غير مسند',
    driverPhone: phone,
    telUrl: buildTelUrl(phone),
    whatsAppUrl: buildWhatsAppIssueUrl(phone, message),
    whatsAppMessage: message
  };
}

import { query } from './index.js';
import type { GuideApplication, GuideWidgetAnswer } from '../models/improvement.js';

function rowToApp(row: Record<string, any>): GuideApplication {
  return {
    id: row.id,
    userId: row.user_id,
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
    region: row.region || 'Global',
    experience: row.experience || '',
    qualifications: row.qualifications || '',
    identificationUrl: row.identification_url || '',
    widgetAnswers: Array.isArray(row.widget_answers) ? (row.widget_answers as GuideWidgetAnswer[]) : [],
    proofPerCategory: (row.proof_per_category && typeof row.proof_per_category === 'object'
      ? row.proof_per_category
      : {}) as GuideApplication['proofPerCategory'],
    status: (row.status as GuideApplication['status']) || 'pending',
    autoApproved: Boolean(row.auto_approved),
    decisionDueAt: row.decision_due_at || null,
    appliedAt: row.applied_at,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
  };
}

export async function listApplications(): Promise<GuideApplication[]> {
  const { rows } = await query(`SELECT * FROM guide_applications ORDER BY applied_at ASC`);
  return rows.map(rowToApp);
}

export async function getById(id: string): Promise<GuideApplication | null> {
  const { rows } = await query(`SELECT * FROM guide_applications WHERE id = $1`, [id]);
  return rows[0] ? rowToApp(rows[0]) : null;
}

export async function getByUserId(userId: string): Promise<GuideApplication | null> {
  const { rows } = await query(
    `SELECT * FROM guide_applications WHERE user_id = $1 ORDER BY applied_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] ? rowToApp(rows[0]) : null;
}

export async function insertApplication(app: GuideApplication): Promise<GuideApplication> {
  await query(
    `INSERT INTO guide_applications (
      id, user_id, status, categories, region, experience, qualifications, identification_url,
      widget_answers, proof_per_category, auto_approved, decision_due_at, reviewed_at, reviewed_by, applied_at
    ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15)`,
    [
      app.id,
      app.userId,
      app.status,
      JSON.stringify(app.categories || []),
      app.region || 'Global',
      app.experience || '',
      app.qualifications || '',
      app.identificationUrl || '',
      JSON.stringify(app.widgetAnswers || []),
      JSON.stringify(app.proofPerCategory || {}),
      Boolean(app.autoApproved),
      app.decisionDueAt ? new Date(app.decisionDueAt) : null,
      app.reviewedAt ? new Date(app.reviewedAt) : null,
      app.reviewedBy,
      app.appliedAt ? new Date(app.appliedAt) : new Date(),
    ]
  );
  return app;
}

export async function updateApplication(app: GuideApplication): Promise<void> {
  await query(
    `UPDATE guide_applications SET
      status = $2,
      categories = $3::jsonb,
      region = $4,
      experience = $5,
      qualifications = $6,
      identification_url = $7,
      widget_answers = $8::jsonb,
      proof_per_category = $9::jsonb,
      auto_approved = $10,
      decision_due_at = $11,
      reviewed_at = $12,
      reviewed_by = $13
     WHERE id = $1`,
    [
      app.id,
      app.status,
      JSON.stringify(app.categories || []),
      app.region || 'Global',
      app.experience || '',
      app.qualifications || '',
      app.identificationUrl || '',
      JSON.stringify(app.widgetAnswers || []),
      JSON.stringify(app.proofPerCategory || {}),
      Boolean(app.autoApproved),
      app.decisionDueAt ? new Date(app.decisionDueAt) : null,
      app.reviewedAt ? new Date(app.reviewedAt) : null,
      app.reviewedBy,
    ]
  );
}

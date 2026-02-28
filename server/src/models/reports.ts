import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export type ReportCategory = 'harassment' | 'fake' | 'inappropriate' | 'spam' | 'scam' | 'underage' | 'violence' | 'other';

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  category: ReportCategory;
  description: string;
  createdAt: Date | string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: Date | string;
  resolution?: string;
}

const REPORTS_PATH = join(process.cwd(), 'server', 'data', 'reports.json');

async function readReports(): Promise<Report[]> {
  try {
    const data = await readFile(REPORTS_PATH, 'utf-8');
    const reports = JSON.parse(data);
    return reports.map((r: Report) => ({
      ...r,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

async function writeReports(reports: Report[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(REPORTS_PATH, JSON.stringify(reports, null, 2));
}

export async function createReport(report: Omit<Report, 'id' | 'createdAt' | 'status'>): Promise<Report> {
  const reports = await readReports();
  const newReport: Report = {
    ...report,
    id: Date.now().toString(),
    createdAt: new Date(),
    status: 'pending',
  };
  reports.push(newReport);
  await writeReports(reports);
  return newReport;
}

export async function getReportsByReporter(reporterId: string): Promise<Report[]> {
  const reports = await readReports();
  return reports.filter(r => r.reporterId === reporterId);
}

export async function getReportsByReported(reportedUserId: string): Promise<Report[]> {
  const reports = await readReports();
  return reports.filter(r => r.reportedUserId === reportedUserId);
}

export async function getAllReports(): Promise<Report[]> {
  return readReports();
}

export async function updateReportStatus(reportId: string, status: Report['status'], reviewedBy?: string, resolution?: string): Promise<Report | null> {
  const reports = await readReports();
  const report = reports.find(r => r.id === reportId);
  if (report) {
    report.status = status;
    if (reviewedBy) {
      report.reviewedBy = reviewedBy;
      report.reviewedAt = new Date();
    }
    if (resolution) {
      report.resolution = resolution;
    }
    await writeReports(reports);
    return report;
  }
  return null;
}




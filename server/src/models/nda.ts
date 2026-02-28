import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface NDASignature {
  id: string;
  interestId: string;
  celebrityUserId: string;
  signerUserId: string;
  signedAt: Date | string;
  signatureData: string; // base64 or data URL
  agreementText: string;
}

const NDA_PATH = join(process.cwd(), 'server', 'data', 'nda-signatures.json');

async function readNDAs(): Promise<NDASignature[]> {
  try {
    const data = await readFile(NDA_PATH, 'utf-8');
    const list = JSON.parse(data);
    return (list || []).map((n: NDASignature) => ({
      ...n,
      signedAt: n.signedAt ? new Date(n.signedAt) : new Date(),
    }));
  } catch {
    return [];
  }
}

async function writeNDAs(ndas: NDASignature[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(NDA_PATH, JSON.stringify(ndas, null, 2), 'utf-8');
}

export async function getNDAByInterest(interestId: string): Promise<NDASignature | null> {
  const ndas = await readNDAs();
  return ndas.find((n) => n.interestId === interestId) || null;
}

export async function hasSignedNDA(interestId: string, signerUserId: string): Promise<boolean> {
  const nda = await getNDAByInterest(interestId);
  return nda ? nda.signerUserId === signerUserId : false;
}

export async function signNDA(params: {
  interestId: string;
  celebrityUserId: string;
  signerUserId: string;
  signatureData: string;
  agreementText: string;
}): Promise<NDASignature> {
  const ndas = await readNDAs();
  const existing = ndas.find((n) => n.interestId === params.interestId && n.signerUserId === params.signerUserId);
  if (existing) return existing;
  const nda: NDASignature = {
    id: Date.now().toString(),
    interestId: params.interestId,
    celebrityUserId: params.celebrityUserId,
    signerUserId: params.signerUserId,
    signedAt: new Date(),
    signatureData: params.signatureData,
    agreementText: params.agreementText,
  };
  ndas.push(nda);
  await writeNDAs(ndas);
  return nda;
}

export async function getNDAsForCelebrity(celebrityUserId: string): Promise<NDASignature[]> {
  const ndas = await readNDAs();
  return ndas.filter((n) => n.celebrityUserId === celebrityUserId);
}

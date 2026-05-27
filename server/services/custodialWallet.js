// server/services/custodialWallet.js
// ─────────────────────────────────────────────────────────────
// 자동 커스터디 지갑 (migration 241).
//   - 가입 시 진짜 EOA 키페어 생성.
//   - 개인키는 AES-256-GCM 으로 암호화하여 저장(서버 마스터키 WALLET_ENCRYPTION_KEY).
//   - 유저는 본인 키를 1회 열람 가능(면책: 분실 시 운영자 책임 없음).
// ⚠️ 보안 원칙:
//   - 마스터키 미설정 시 키 생성/암호화 거부(평문 저장 절대 금지).
//   - 개인키/니모닉은 절대 로그에 남기지 않는다.
//   - 마스터키는 env/시크릿매니저로만. 프로덕션은 KMS 권장.
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto');
const { ethers } = require('ethers');
const { getSetting } = require('../db');

// 마스터키 → 32바이트 (sha256 of WALLET_ENCRYPTION_KEY). 미설정/짧으면 null.
function getMasterKey() {
  const k = process.env.WALLET_ENCRYPTION_KEY;
  if (!k || String(k).length < 16) return null;
  return crypto.createHash('sha256').update(String(k)).digest();
}

function isConfigured() { return !!getMasterKey(); }

// 자동 커스터디 활성화 여부(설정 + 마스터키 둘 다 필요)
async function isEnabled() {
  if (!isConfigured()) return false;
  try { return String(await getSetting('custodial_wallet_enabled', 'false')) === 'true'; }
  catch (_) { return false; }
}

function generateWallet() {
  const w = ethers.Wallet.createRandom();
  return {
    address: w.address.toLowerCase(),
    privateKey: w.privateKey,
    mnemonic: (w.mnemonic && w.mnemonic.phrase) || null
  };
}

// privateKey(문자열) → "iv:tag:ciphertext" (모두 hex)
function encryptPrivateKey(privateKey) {
  const mk = getMasterKey();
  if (!mk) throw new Error('WALLET_ENCRYPTION_KEY not set');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', mk, iv);
  const enc = Buffer.concat([cipher.update(String(privateKey), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decryptPrivateKey(blob) {
  const mk = getMasterKey();
  if (!mk) throw new Error('WALLET_ENCRYPTION_KEY not set');
  const parts = String(blob || '').split(':');
  if (parts.length !== 3) throw new Error('bad ciphertext format');
  const [ivH, tagH, dataH] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', mk, Buffer.from(ivH, 'hex'));
  decipher.setAuthTag(Buffer.from(tagH, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataH, 'hex')), decipher.final()]).toString('utf8');
}

module.exports = { isConfigured, isEnabled, generateWallet, encryptPrivateKey, decryptPrivateKey };

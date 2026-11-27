/** VERIFIKASI 2 LANGKAH (TOTP) — kode 6 angka dari aplikasi Google Authenticator / Microsoft Authenticator dsb. */
import * as OTPAuth from 'otpauth';

const PENERBIT = 'Seemitra Lite';
const buatTotp = (rahasia: string, label = 'akun') =>
  new OTPAuth.TOTP({ issuer: PENERBIT, label, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(rahasia) });

export function rahasiaBaru() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}
export function alamatOtpauth(rahasia: string, username: string) {
  return buatTotp(rahasia, username).toString();
}
/** true bila kode cocok (toleransi ±30 detik untuk jam HP yang sedikit melenceng) */
export function cekKodeTotp(rahasia: string, kode: unknown) {
  const k = String(kode ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(k)) return false;
  return buatTotp(rahasia).validate({ token: k, window: 1 }) !== null;
}

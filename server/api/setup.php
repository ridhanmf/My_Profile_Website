<?php
/**
 * One-time setup: checks the database connection, creates the tables and the first admin account.
 * Requires the setup token from config.php. Once an admin exists this page does nothing,
 * and you can delete this file.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

kb_headers();
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");

$cfg = kb_config();
$token = (string)($cfg['setup_token'] ?? '');
$msg = ''; $kind = 'info'; $done = false;

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

$dbOk = true; $dbErr = '';
try { kb_db()->query('SELECT 1'); } catch (Throwable $e) { $dbOk = false; }

if ($dbOk && kb_admin_count() > 0) {
    $done = true;
    $msg = 'Setup sudah selesai: akun admin sudah ada. Demi keamanan, hapus file api/setup.php dari File Manager.';
    $kind = 'ok';
} elseif ($dbOk && kb_method() === 'POST') {
    kb_ensure_schema();
    $wait = kb_locked_for();
    $sent = (string)($_POST['token'] ?? '');
    $user = trim((string)($_POST['username'] ?? ''));
    $pass = (string)($_POST['password'] ?? '');
    $pass2 = (string)($_POST['password2'] ?? '');
    if ($wait > 0) { $msg = 'Terlalu banyak percobaan. Coba lagi dalam ' . ceil($wait / 60) . ' menit.'; $kind = 'err'; }
    elseif (strlen($token) < 24 || strpos($token, 'GANTI') === 0) { $msg = 'setup_token di api/config.php belum diisi (minimal 24 karakter).'; $kind = 'err'; }
    elseif (!hash_equals($token, $sent)) { kb_record_fail(); $msg = 'Setup token salah. Salin persis dari api/config.php.'; $kind = 'err'; }
    elseif (!kb_valid_username($user)) { $msg = 'Username 3–64 karakter: huruf, angka, titik, strip, atau garis bawah.'; $kind = 'err'; }
    elseif (!kb_valid_password($pass)) { $msg = 'Password minimal 10 karakter.'; $kind = 'err'; }
    elseif ($pass !== $pass2) { $msg = 'Kedua password tidak sama.'; $kind = 'err'; }
    else {
        kb_db()->prepare('INSERT INTO kb_admins (username, pass_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
            ->execute([$user, password_hash($pass, PASSWORD_DEFAULT), kb_now(), kb_now()]);
        kb_clear_fails();
        $done = true; $kind = 'ok';
        $msg = 'Berhasil! Tabel database dan akun admin "' . $user . '" sudah dibuat. Sekarang hapus file api/setup.php, lalu buka website Anda dan klik "Admin login" di bagian bawah.';
    }
}
$drv = $dbOk ? kb_driver() : '';
?><!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Setup admin website</title>
<style>
  body { margin: 0; font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; background: #eef1f4; color: #111821; }
  main { max-width: 520px; margin: 40px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid #d7dde4; border-radius: 14px; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 6px; } p { margin: 0 0 12px; color: #3a4553; }
  label { display: grid; gap: 5px; margin-top: 12px; font-weight: 600; font-size: 13.5px; }
  input { font: inherit; padding: 10px 12px; border: 1px solid #c9d1db; border-radius: 8px; }
  button { margin-top: 18px; width: 100%; font: inherit; font-weight: 700; padding: 11px; border: 0; border-radius: 8px; background: #1f4fd8; color: #fff; cursor: pointer; }
  .msg { padding: 10px 12px; border-radius: 8px; margin: 12px 0; } .ok { background: #dcf2e3; color: #17803d; } .err { background: #fadede; color: #c22b2b; } .info { background: #e3eafc; color: #1f4fd8; }
  .check { font-size: 13.5px; } code { background: #f1f3f6; padding: 1px 5px; border-radius: 4px; }
</style></head>
<body><main><div class="card">
  <h1>Setup admin website</h1>
  <p class="check">Koneksi database: <?= $dbOk ? '<b style="color:#17803d">tersambung (' . h($drv) . ')</b>' : '<b style="color:#c22b2b">gagal</b> — periksa db_host, db_name, db_user, dan db_pass di <code>api/config.php</code>.' ?></p>
  <?php if ($msg): ?><div class="msg <?= h($kind) ?>"><?= h($msg) ?></div><?php endif; ?>
  <?php if ($dbOk && !$done): ?>
  <form method="post" autocomplete="off">
    <label>Setup token (dari <code>api/config.php</code>)<input name="token" required></label>
    <label>Username admin<input name="username" required autocapitalize="off" spellcheck="false" pattern="[A-Za-z0-9._\-]{3,64}"></label>
    <label>Password admin (minimal 10 karakter)<input name="password" type="password" required minlength="10" autocomplete="new-password"></label>
    <label>Ulangi password<input name="password2" type="password" required minlength="10" autocomplete="new-password"></label>
    <button type="submit">Buat tabel &amp; akun admin</button>
  </form>
  <?php endif; ?>
</div></main></body></html>

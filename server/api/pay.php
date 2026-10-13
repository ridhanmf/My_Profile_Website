<?php
/**
 * Public payment page for one link:  pay.php?t=TOKEN
 * Opening this page never marks anything as paid. With PayPro it forwards to PayPro's checkout;
 * the bill only becomes "Lunas" after a verified notification reaches webhook.php.
 */
declare(strict_types=1);
require __DIR__ . '/_kos.php';

kb_headers();
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
header('X-Robots-Tag: noindex');
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$token = (string)($_GET['t'] ?? '');
$p = null; $b = null; $s = null;
try {
    kos_ensure_schema();
    kos_expire_links();
    $s = kos_settings();
    if (preg_match('/^[a-f0-9]{40}$/', $token)) {
        $st = kb_db()->prepare('SELECT * FROM kos_payments WHERE token = ?'); $st->execute([$token]); $p = $st->fetch() ?: null;
        if ($p) $b = kos_bill((int)$p['bill_id']);
    }
} catch (Throwable $e) { $p = null; }

$state = !$p ? 'missing' : ($b['status'] === 'paid' ? 'paid' : $p['status']);
$title = ['missing' => 'Link tidak ditemukan', 'paid' => 'Tagihan sudah lunas', 'success' => 'Pembayaran diterima', 'pending' => 'Pembayaran tagihan', 'failed' => 'Pembayaran gagal', 'expired' => 'Link kedaluwarsa'][$state] ?? 'Pembayaran';
$sim = $p && $p['gateway'] === 'simulation';
?><!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title><?= h($title) ?></title>
<style>
  body { margin: 0; font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; background: #eef1f4; color: #111821; }
  main { max-width: 460px; margin: 32px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid #d7dde4; border-radius: 14px; padding: 22px; }
  h1 { font-size: 21px; margin: 0 0 4px; } p { margin: 8px 0; color: #3a4553; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 16px 0; } dt { color: #5b6675; } dd { margin: 0; font-weight: 600; text-align: right; }
  .amt { font-size: 26px; font-weight: 800; margin: 6px 0 0; }
  .msg { padding: 10px 12px; border-radius: 8px; margin: 12px 0; font-size: 14px; } .ok { background: #dcf2e3; color: #17803d; } .err { background: #fadede; color: #c22b2b; } .info { background: #e3eafc; color: #1f4fd8; } .warn { background: #fff1d6; color: #8a5a00; }
  a.btn { display: block; text-align: center; margin-top: 14px; font-weight: 700; padding: 12px; border-radius: 9px; background: #1f4fd8; color: #fff; text-decoration: none; }
  small { color: #6b7684; }
</style></head>
<body><main><div class="card">
  <small><?= h($s['property_name'] ?? 'KostBills') ?></small>
  <h1><?= h($title) ?></h1>
  <?php if ($state === 'missing'): ?>
    <p>Link pembayaran ini tidak dikenal. Periksa kembali link dari pesan WhatsApp, atau minta link baru ke pengelola.</p>
  <?php else: ?>
    <dl>
      <dt>Kamar</dt><dd><?= h($b['room_id']) ?> · <?= h($b['room_type']) ?></dd>
      <dt>Periode</dt><dd><?= h(kos_period_label($b['period_start'])) ?><?= (int)$b['months'] > 1 ? ' – ' . h(kos_period_label($b['period_end'])) . ' (' . (int)$b['months'] . ' bulan)' : '' ?></dd>
      <dt>Masa sewa</dt><dd><?= h(kos_date_label($b['start_date'])) ?> – <?= h(kos_date_label($b['end_date'])) ?></dd>
      <dt>Jatuh tempo</dt><dd><?= h(kos_date_label($b['due_date'])) ?></dd>
      <?php if ((int)$b['discount_amount'] > 0): ?><dt>Diskon</dt><dd><?= h(kos_rp((int)$b['discount_amount'])) ?></dd><?php endif; ?>
      <dt>Invoice</dt><dd><?= h($b['code']) ?></dd>
    </dl>
    <p>Jumlah link ini</p><p class="amt"><?= h(kos_rp((int)$p['amount'])) ?></p>
    <?php if ($state === 'paid' || $state === 'success'): ?>
      <div class="msg ok">Pembayaran sudah tercatat. Terima kasih.</div>
    <?php elseif ($state === 'expired'): ?>
      <div class="msg warn">Link ini sudah tidak berlaku. Minta link baru ke pengelola.</div>
    <?php elseif ($state === 'failed'): ?>
      <div class="msg err">Pembayaran lewat link ini gagal. Minta link baru ke pengelola.</div>
    <?php elseif ($sim): ?>
      <div class="msg info"><b>Mode simulasi.</b> Payment gateway belum aktif, jadi tidak ada pembayaran sungguhan di halaman ini dan tidak ada uang yang ditarik. Status tagihan hanya berubah setelah notifikasi pembayaran terverifikasi diterima server.</div>
    <?php elseif ($p['checkout_url'] && preg_match('#^https://#', (string)$p['checkout_url'])): ?>
      <a class="btn" href="<?= h($p['checkout_url']) ?>" rel="noopener">Lanjut bayar di PayPro</a>
      <p><small>Link berlaku sampai <?= h(kos_date_label($p['expires_at'])) ?> <?= h(substr((string)$p['expires_at'], 11, 5)) ?> WIB. Status menjadi Lunas setelah PayPro mengonfirmasi pembayaran.</small></p>
    <?php else: ?>
      <div class="msg warn">Pembayaran online belum tersedia. Hubungi pengelola.</div>
    <?php endif; ?>
  <?php endif; ?>
</div></main></body></html>

<?php
/**
 * Daily job: expire old payment links, create this month's bills (idempotent), send due-date reminders.
 *   Hostinger hPanel → Advanced → Cron Jobs, once a day, for example:
 *     php /home/USER/domains/DOMAIN/public_html/api/cron.php
 *   or by URL (needs CRON_KEY, 24+ characters):  https://DOMAIN/api/cron.php?key=CRON_KEY
 */
declare(strict_types=1);
require __DIR__ . '/_kos.php';

if (PHP_SAPI !== 'cli') {
    $key = kos_env('CRON_KEY');
    if (strlen($key) < 24 || !hash_equals($key, (string)($_GET['key'] ?? ''))) kb_fail(403, 'forbidden', 'Cron key missing or wrong.');
}
try {
    kos_ensure_schema();
    $r = kos_daily(['username' => 'cron', 'role' => 'system']);
    if (PHP_SAPI === 'cli') { echo json_encode($r, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"; exit(0); }
    kb_json(200, ['ok' => true] + $r);
} catch (KosError $e) {
    if (PHP_SAPI === 'cli') { fwrite(STDERR, $e->getMessage() . "\n"); exit(1); }
    kb_fail($e->status, $e->codeName, $e->getMessage());
}

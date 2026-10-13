<?php
/**
 * KostBills operational data (MySQL): rooms, tenants, bills, payments, WhatsApp log, commissions, audit.
 * Not an endpoint (blocked here and in .htaccess). Used by kos.php, pay.php, webhook.php and cron.php.
 *
 * Money is whole Rupiah stored as integers. Business dates use Asia/Jakarta.
 * Every bill belongs to one tenant and covers whole billing months; kos_bill_months has one row per
 * (tenant, month) so a month can never be billed twice, whether by a monthly bill or a prepayment.
 */
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
require_once __DIR__ . '/_lib.php';
require_once __DIR__ . '/_gateways.php';

date_default_timezone_set('Asia/Jakarta');

const KOS_SCHEMA = 1;
const KOS_TYPES = ['Regular', 'Premium', 'Expensive'];
const KOS_BLOCKS = 'ABCDEFGHIJ';
const KOS_DEFAULT_BASE = 850000;
const KOS_MONTH_OPTIONS = [1, 6, 12];
const KOS_PAY_METHODS = ['Transfer BCA', 'QRIS', 'Transfer Mandiri', 'Transfer BRI', 'Cash'];
const KOS_MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

final class KosError extends Exception
{
    public int $status; public string $codeName; public array $extra;
    public function __construct(int $status, string $code, string $message, array $extra = [])
    { parent::__construct($message); $this->status = $status; $this->codeName = $code; $this->extra = $extra; }
}
function kos_err(int $status, string $code, string $message, array $extra = []): void { throw new KosError($status, $code, $message, $extra); }

/* ---------------- configuration (environment variables first, then api/config.php) ---------------- */

/** Reads a setting from the environment (SetEnv / hosting panel) or from config.php ['env' => [...]] or a
    top-level key of config.php. Credentials therefore never live in the source code or in git. */
function kos_env(string $key, string $default = ''): string
{
    $v = getenv($key);
    if ($v !== false && $v !== '') return (string)$v;
    if (isset($_SERVER[$key]) && is_string($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];
    $c = kb_config();
    if (isset($c['env'][$key]) && (string)$c['env'][$key] !== '') return (string)$c['env'][$key];
    if (isset($c[strtolower($key)]) && is_scalar($c[strtolower($key)]) && (string)$c[strtolower($key)] !== '') return (string)$c[strtolower($key)];
    return $default;
}

/** Today's date. config.php may pin it ('kos_today' => 'Y-m-d') for automated tests only. */
function kos_today(): string
{
    $c = kb_config();
    if (!empty($c['kos_today']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$c['kos_today'])) return (string)$c['kos_today'];
    return date('Y-m-d');
}
function kos_now(): string
{
    $c = kb_config();
    if (!empty($c['kos_today'])) return kos_today() . date(' H:i:s');
    return date('Y-m-d H:i:s');
}

/* ---------------- dates and periods ---------------- */

function kos_valid_date(string $d): bool
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) return false;
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}
function kos_valid_period(string $p): bool { return (bool)preg_match('/^(20\d{2})-(0[1-9]|1[0-2])$/', $p); }
function kos_period_of(string $date): string { return substr($date, 0, 7); }
function kos_period_add(string $p, int $k): string
{
    [$y, $m] = array_map('intval', explode('-', $p));
    $n = $y * 12 + ($m - 1) + $k;
    return sprintf('%04d-%02d', intdiv($n, 12), $n % 12 + 1);
}
function kos_due_for(string $p, int $day): string
{
    [$y, $m] = array_map('intval', explode('-', $p));
    $last = (int)date('t', mktime(0, 0, 0, $m, 1, $y));
    return sprintf('%04d-%02d-%02d', $y, $m, min(max(1, $day), $last));
}
function kos_add_days(string $d, int $k): string { return (new DateTimeImmutable($d))->modify(($k >= 0 ? '+' : '') . $k . ' day')->format('Y-m-d'); }
function kos_days_between(string $from, string $to): int { return (int)round(((new DateTimeImmutable($to))->getTimestamp() - (new DateTimeImmutable($from))->getTimestamp()) / 86400); }
/** A bill for $months months starting at period $p runs from the due day of $p up to the day before the due day $months later. */
function kos_window(string $p, int $day, int $months): array
{
    $start = kos_due_for($p, $day);
    $end = kos_add_days(kos_due_for(kos_period_add($p, $months), $day), -1);
    return [$start, $end];
}
function kos_period_label(string $p): string { [$y, $m] = explode('-', $p); return KOS_MONTHS_ID[(int)$m - 1] . ' ' . $y; }
function kos_date_label(?string $d): string { if (!$d) return '—'; [$y, $m, $dd] = explode('-', substr($d, 0, 10)); return (int)$dd . ' ' . substr(KOS_MONTHS_ID[(int)$m - 1], 0, 3) . ' ' . $y; }
function kos_rp(int $n): string { return 'Rp' . number_format($n, 0, ',', '.'); }

/* ---------------- schema ---------------- */

function kos_ensure_schema(): void
{
    static $done = false;
    if ($done) return;
    $pdo = kb_db();
    try {
        $r = $pdo->query("SELECT v FROM kos_settings WHERE k = 'schema'")->fetch();
        if ($r && (int)json_decode($r['v']) >= KOS_SCHEMA) { $done = true; kb_ensure_roles(); return; }
    } catch (PDOException $e) { /* not created yet */ }
    kb_ensure_schema();
    $my = kb_driver() === 'mysql';
    $id = $my ? 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $tail = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $tables = [
        'kos_settings' => ['k VARCHAR(64) PRIMARY KEY, v TEXT NOT NULL, updated_at DATETIME NULL', []],
        'kos_room_types' => ['type VARCHAR(16) PRIMARY KEY, base_price INT NOT NULL, updated_at DATETIME NULL', []],
        'kos_rooms' => ['id VARCHAR(8) PRIMARY KEY, block CHAR(1) NOT NULL, floor INT NOT NULL, num INT NOT NULL, type VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL, updated_at DATETIME NULL', []],
        // active_room equals room_id while the tenant lives there and NULL afterwards: the UNIQUE index
        // guarantees at most one active tenant per room.
        'kos_tenants' => ["id $id, room_id VARCHAR(8) NOT NULL, active_room VARCHAR(8) NULL UNIQUE, name VARCHAR(120) NOT NULL, phone VARCHAR(20) NOT NULL DEFAULT '', job VARCHAR(80) NOT NULL DEFAULT '', check_in DATE NOT NULL, check_out DATE NULL, due_day INT NULL, deposit INT NOT NULL DEFAULT 0, active INT NOT NULL DEFAULT 1, paid_until DATE NULL, source VARCHAR(16) NOT NULL DEFAULT 'admin', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL", [['room_id']]],
        'kos_bills' => ["id $id, code VARCHAR(48) NOT NULL UNIQUE, tenant_id BIGINT NOT NULL, room_id VARCHAR(8) NOT NULL, kind VARCHAR(10) NOT NULL, months INT NOT NULL, period_start CHAR(7) NOT NULL, period_end CHAR(7) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, due_date DATE NOT NULL, room_type VARCHAR(16) NOT NULL, base_price INT NOT NULL, markup INT NOT NULL, sale_price INT NOT NULL, subtotal INT NOT NULL, discount_bp INT NOT NULL DEFAULT 0, discount_amount INT NOT NULL DEFAULT 0, total INT NOT NULL, profit_model VARCHAR(12) NOT NULL, profit INT NOT NULL DEFAULT 0, paid INT NOT NULL DEFAULT 0, status VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL, paid_at DATETIME NULL, voided_at DATETIME NULL, void_reason VARCHAR(200) NULL", [['tenant_id'], ['period_start'], ['status']]],
        'kos_bill_months' => ['tenant_id BIGINT NOT NULL, period CHAR(7) NOT NULL, bill_id BIGINT NOT NULL, PRIMARY KEY (tenant_id, period)', [['bill_id']]],
        'kos_payments' => ["id $id, bill_id BIGINT NOT NULL, tenant_id BIGINT NOT NULL, gateway VARCHAR(16) NOT NULL, token VARCHAR(64) NULL UNIQUE, ref VARCHAR(100) NULL, amount INT NOT NULL, status VARCHAR(10) NOT NULL, method VARCHAR(40) NOT NULL DEFAULT '', checkout_url TEXT NULL, expires_at DATETIME NULL, note VARCHAR(255) NULL, actor VARCHAR(64) NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, paid_at DATETIME NULL, UNIQUE (gateway, ref)", [['bill_id'], ['status']]],
        'kos_webhook_events' => ["id $id, gateway VARCHAR(16) NOT NULL, payload_hash CHAR(64) NOT NULL UNIQUE, ref VARCHAR(100) NULL, token VARCHAR(64) NULL, event_status VARCHAR(16) NULL, amount INT NULL, signature_ok INT NOT NULL, result VARCHAR(40) NOT NULL, received_at DATETIME NOT NULL", []],
        'kos_commissions' => ["id $id, tenant_id BIGINT NOT NULL, period CHAR(7) NOT NULL, bill_id BIGINT NOT NULL, amount INT NOT NULL, created_at DATETIME NOT NULL, UNIQUE (tenant_id, period)", [['period']]],
        'kos_wa_messages' => ["id $id, tenant_id BIGINT NOT NULL, bill_id BIGINT NULL, kind VARCHAR(24) NOT NULL, dedupe VARCHAR(80) NULL UNIQUE, to_phone VARCHAR(20) NOT NULL, body TEXT NOT NULL, driver VARCHAR(16) NOT NULL, status VARCHAR(12) NOT NULL, provider_id VARCHAR(120) NULL, error VARCHAR(255) NULL, actor VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL", [['bill_id'], ['tenant_id']]],
        'kos_audit' => ["id $id, at DATETIME NOT NULL, actor VARCHAR(64) NOT NULL, role VARCHAR(16) NOT NULL, action VARCHAR(40) NOT NULL, entity VARCHAR(20) NOT NULL, entity_id VARCHAR(48) NOT NULL, detail TEXT NULL", [['action']]],
    ];
    foreach ($tables as $name => [$cols, $idx]) {
        $keys = '';
        if ($my) foreach ($idx as $i => $c) $keys .= ', KEY ' . $name . '_i' . $i . ' (' . implode(', ', $c) . ')';
        $pdo->exec("CREATE TABLE IF NOT EXISTS $name ($cols$keys)$tail");
        if (!$my) foreach ($idx as $i => $c) $pdo->exec('CREATE INDEX IF NOT EXISTS ' . $name . '_i' . $i . " ON $name (" . implode(', ', $c) . ')');
    }
    $pdo->beginTransaction();
    try {
        if ((int)$pdo->query('SELECT COUNT(*) AS n FROM kos_room_types')->fetch()['n'] === 0) {
            $st = $pdo->prepare('INSERT INTO kos_room_types (type, base_price, updated_at) VALUES (?, ?, ?)');
            foreach (KOS_TYPES as $t) $st->execute([$t, KOS_DEFAULT_BASE, kb_now()]);
        }
        if ((int)$pdo->query('SELECT COUNT(*) AS n FROM kos_rooms')->fetch()['n'] === 0) {
            // Same layout as the demo: 10 blocks × 4 floors × 25 rooms. Per block 10 Premium (floor 3, rooms 16–25)
            // and 5 Expensive (floor 4, rooms 21–25). Operational rooms start empty (no tenants, no demo data).
            $st = $pdo->prepare('INSERT INTO kos_rooms (id, block, floor, num, type, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
            foreach (str_split(KOS_BLOCKS) as $b) for ($f = 1; $f <= 4; $f++) for ($n = 1; $n <= 25; $n++) {
                $type = $f === 4 && $n >= 21 ? 'Expensive' : ($f === 3 && $n >= 16 ? 'Premium' : 'Regular');
                $st->execute([sprintf('%s-%d%02d', $b, $f, $n), $b, $f, $n, $type, 'Vacant', kb_now()]);
            }
        }
        foreach (kos_default_settings() as $k => $v) {
            $q = $pdo->prepare('SELECT 1 FROM kos_settings WHERE k = ?'); $q->execute([$k]);
            if (!$q->fetch()) $pdo->prepare('INSERT INTO kos_settings (k, v, updated_at) VALUES (?, ?, ?)')->execute([$k, json_encode($v), kb_now()]);
        }
        $q = $pdo->prepare("SELECT 1 FROM kos_settings WHERE k = 'sim_secret'"); $q->execute();
        if (!$q->fetch()) $pdo->prepare("INSERT INTO kos_settings (k, v, updated_at) VALUES ('sim_secret', ?, ?)")->execute([json_encode(bin2hex(random_bytes(32))), kb_now()]);
        $pdo->prepare("DELETE FROM kos_settings WHERE k = 'schema'")->execute();
        $pdo->prepare("INSERT INTO kos_settings (k, v, updated_at) VALUES ('schema', ?, ?)")->execute([json_encode(KOS_SCHEMA), kb_now()]);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    $done = true;
}

/* ---------------- settings ---------------- */

function kos_default_settings(): array
{
    return [
        'property_name' => 'Griya Kos Sejahtera',
        'profit_model' => 'commission',             // 'commission' (Rp5.000/tenant/month) or 'markup'
        'commission_amount' => 5000,
        'markup' => ['Regular' => 5000, 'Premium' => 5000, 'Expensive' => 5000],
        'discount_bp' => ['6' => 0, '12' => 0],      // basis points: 500 = 5%
        'reminders_before' => [7, 3, 1],
        'reminders_after' => [1, 3, 7],
        'send_on_generate' => true,
        'link_ttl_hours' => 72,
        'refund_policy' => 'Tidak ada refund otomatis. Sisa masa sewa yang sudah dibayar dibahas langsung dengan pengelola sesuai perjanjian sewa.',
        'demo_enabled' => true,
        'public_base_url' => '',
    ];
}
function kos_settings(): array
{
    $out = kos_default_settings();
    foreach (kb_db()->query('SELECT k, v FROM kos_settings')->fetchAll() as $r) $out[$r['k']] = json_decode($r['v'], true);
    // An environment variable can force the demo role off for a live deployment.
    $env = kos_env('KOS_DEMO_ENABLED');
    if ($env !== '') $out['demo_enabled'] = in_array(strtolower($env), ['1', 'true', 'yes', 'on'], true);
    return $out;
}
function kos_setting_put(string $k, $v): void
{
    $pdo = kb_db();
    $pdo->prepare('DELETE FROM kos_settings WHERE k = ?')->execute([$k]);
    $pdo->prepare('INSERT INTO kos_settings (k, v, updated_at) VALUES (?, ?, ?)')->execute([$k, json_encode($v), kb_now()]);
}
function kos_base_prices(): array
{
    $out = [];
    foreach (kb_db()->query('SELECT type, base_price FROM kos_room_types')->fetchAll() as $r) $out[$r['type']] = (int)$r['base_price'];
    return $out;
}
/** Price for one month of a room class under the active profit model. Base, markup and sale price are kept apart. */
function kos_price(string $type, ?array $s = null, ?array $bases = null): array
{
    $s = $s ?? kos_settings(); $bases = $bases ?? kos_base_prices();
    $base = (int)($bases[$type] ?? KOS_DEFAULT_BASE);
    $model = $s['profit_model'] === 'markup' ? 'markup' : 'commission';
    $markup = $model === 'markup' ? max(0, (int)($s['markup'][$type] ?? 0)) : 0;
    return ['type' => $type, 'base' => $base, 'markup' => $markup, 'sale' => $base + $markup, 'model' => $model];
}
/** Quote for $months months: total = sale price × months − discount. Admin profit: markup × months (markup model). */
function kos_quote(string $type, int $months, ?array $s = null): array
{
    if (!in_array($months, KOS_MONTH_OPTIONS, true)) kos_err(422, 'bad_months', 'Lama pembayaran harus 1, 6, atau 12 bulan.');
    $s = $s ?? kos_settings();
    $p = kos_price($type, $s);
    $bp = $months > 1 ? max(0, min(5000, (int)($s['discount_bp'][(string)$months] ?? 0))) : 0;
    $subtotal = $p['sale'] * $months;
    $discount = intdiv($subtotal * $bp + 5000, 10000); // rounded to the nearest rupiah
    return $p + ['months' => $months, 'subtotal' => $subtotal, 'discount_bp' => $bp, 'discount' => $discount, 'total' => $subtotal - $discount,
        'profit' => $p['model'] === 'markup' ? $p['markup'] * $months : 0,
        'commission' => $p['model'] === 'commission' ? (int)$s['commission_amount'] * $months : 0];
}

/* ---------------- audit ---------------- */

function kos_audit(array $actor, string $action, string $entity, string $entityId, array $detail = []): void
{
    kb_db()->prepare('INSERT INTO kos_audit (at, actor, role, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([kos_now(), $actor['username'] ?? 'system', $actor['role'] ?? 'system', $action, $entity, $entityId, json_encode($detail, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
}
const KOS_SYSTEM = ['username' => 'system', 'role' => 'system'];

/** Runs $fn inside a database transaction; rolls back on any error. */
function kos_tx(callable $fn)
{
    $pdo = kb_db();
    $own = !$pdo->inTransaction();
    if ($own) $pdo->beginTransaction();
    try { $r = $fn($pdo); if ($own) $pdo->commit(); return $r; }
    catch (Throwable $e) { if ($own && $pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
function kos_lock(): string { return kb_driver() === 'mysql' ? ' FOR UPDATE' : ''; }

/* ---------------- validation ---------------- */

function kos_int($v, int $min, int $max, string $field): int
{
    if (is_string($v) && preg_match('/^-?\d+$/', trim($v))) $v = (int)trim($v);
    if (!is_int($v) || $v < $min || $v > $max) kos_err(422, 'bad_' . $field, "Nilai $field tidak valid (harus bilangan bulat $min–$max).");
    return $v;
}
function kos_str($v, int $min, int $max, string $field): string
{
    $s = trim(preg_replace('/\s+/u', ' ', (string)$v));
    $len = mb_strlen($s);
    if ($len < $min || $len > $max) kos_err(422, 'bad_' . $field, "Isian $field harus $min–$max karakter.");
    return $s;
}
/** Indonesian mobile number → 08xxxxxxxxxx, or '' when empty. Throws when present but invalid. */
function kos_phone($v, bool $required = false): string
{
    $raw = preg_replace('/[\s().-]/', '', (string)$v);
    if ($raw === '') { if ($required) kos_err(422, 'bad_phone', 'Nomor WhatsApp wajib diisi.'); return ''; }
    if (preg_match('/^(?:\+?62|0)(8\d{7,12})$/', $raw, $m)) return '0' . $m[1];
    kos_err(422, 'bad_phone', 'Nomor WhatsApp tidak valid. Gunakan format 08xx atau +628xx.');
    return '';
}
function kos_phone_ok(string $p): bool { return (bool)preg_match('/^08\d{7,12}$/', $p); }
function kos_wa_number(string $p): string { return '62' . substr($p, 1); }

/* ---------------- lookups ---------------- */

function kos_room(string $id, bool $lock = false): array
{
    $st = kb_db()->prepare('SELECT * FROM kos_rooms WHERE id = ?' . ($lock ? kos_lock() : ''));
    $st->execute([$id]);
    $r = $st->fetch();
    if (!$r) kos_err(404, 'no_room', 'Kamar tidak ditemukan.');
    return $r;
}
function kos_tenant(int $id, bool $lock = false): array
{
    $st = kb_db()->prepare('SELECT * FROM kos_tenants WHERE id = ?' . ($lock ? kos_lock() : ''));
    $st->execute([$id]);
    $r = $st->fetch();
    if (!$r) kos_err(404, 'no_tenant', 'Penghuni tidak ditemukan.');
    return $r;
}
function kos_bill(int $id, bool $lock = false): array
{
    $st = kb_db()->prepare('SELECT * FROM kos_bills WHERE id = ?' . ($lock ? kos_lock() : ''));
    $st->execute([$id]);
    $r = $st->fetch();
    if (!$r) kos_err(404, 'no_bill', 'Tagihan tidak ditemukan.');
    return $r;
}
function kos_tenant_code(int $id): string { return 'T' . str_pad((string)$id, 4, '0', STR_PAD_LEFT); }
function kos_covered(int $tenantId, string $period): bool
{
    $st = kb_db()->prepare('SELECT 1 FROM kos_bill_months WHERE tenant_id = ? AND period = ?');
    $st->execute([$tenantId, $period]);
    return (bool)$st->fetch();
}

/* ---------------- bills ---------------- */

/** Creates one bill for $months months from $period for an active tenant. Returns null when any of those
    months is already billed to this tenant (the bill_months primary key makes this race-safe). */
function kos_create_bill(array $tenant, string $period, int $months, array $actor, ?array $s = null): ?array
{
    if (!(int)$tenant['active']) kos_err(409, 'inactive', 'Penghuni sudah tidak aktif.');
    if (!$tenant['due_day']) kos_err(422, 'no_due_day', 'Tanggal jatuh tempo penghuni belum diisi.');
    $s = $s ?? kos_settings();
    $room = kos_room($tenant['room_id']);
    $q = kos_quote($room['type'], $months, $s);
    $periods = []; for ($i = 0; $i < $months; $i++) $periods[] = kos_period_add($period, $i);
    return kos_tx(function (PDO $pdo) use ($tenant, $period, $months, $actor, $room, $q, $periods) {
        foreach ($periods as $p) if (kos_covered((int)$tenant['id'], $p)) return null;
        [$start, $end] = kos_window($period, (int)$tenant['due_day'], $months);
        $kind = $months === 1 ? 'monthly' : 'prepay';
        $base = ($months === 1 ? 'INV-' : 'PRE-') . substr(str_replace('-', '', $period), 2) . '-' . str_replace('-', '', $room['id']) . '-' . kos_tenant_code((int)$tenant['id']) . ($months > 1 ? "-{$months}M" : '');
        $code = $base;
        for ($n = 2; ; $n++) { $c = $pdo->prepare('SELECT 1 FROM kos_bills WHERE code = ?'); $c->execute([$code]); if (!$c->fetch()) break; $code = "$base-$n"; }
        $now = kos_now();
        $pdo->prepare('INSERT INTO kos_bills (code, tenant_id, room_id, kind, months, period_start, period_end, start_date, end_date, due_date, room_type, base_price, markup, sale_price, subtotal, discount_bp, discount_amount, total, profit_model, profit, paid, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)')
            ->execute([$code, $tenant['id'], $room['id'], $kind, $months, $period, end($periods), $start, $end, $start, $room['type'], $q['base'], $q['markup'], $q['sale'], $q['subtotal'], $q['discount_bp'], $q['discount'], $q['total'], $q['model'], $q['profit'], 'open', $now]);
        $billId = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare('INSERT INTO kos_bill_months (tenant_id, period, bill_id) VALUES (?, ?, ?)');
        try { foreach ($periods as $p) $ins->execute([$tenant['id'], $p, $billId]); }
        catch (PDOException $e) { throw new KosError(409, 'duplicate_period', 'Periode itu sudah ditagihkan ke penghuni ini.'); }
        kos_audit($actor, $kind === 'monthly' ? 'bill.create' : 'bill.prepay', 'bill', $code, ['tenant' => (int)$tenant['id'], 'room' => $room['id'], 'period' => $period, 'months' => $months, 'base' => $q['base'], 'markup' => $q['markup'], 'sale' => $q['sale'], 'discount' => $q['discount'], 'total' => $q['total'], 'model' => $q['model']]);
        return kos_bill($billId);
    });
}

/** Monthly bills for every active tenant for $period. Idempotent: already-covered months are skipped. */
function kos_generate(string $period, array $actor): array
{
    if (!kos_valid_period($period)) kos_err(422, 'bad_period', 'Periode harus berformat YYYY-MM.');
    $today = kos_today();
    if ($period > kos_period_add(kos_period_of($today), 1)) kos_err(422, 'too_far', 'Tagihan hanya bisa dibuat sampai bulan depan.');
    $s = kos_settings();
    $created = []; $skipped = 0; $missing = [];
    $st = kb_db()->query('SELECT * FROM kos_tenants WHERE active = 1 ORDER BY id');
    foreach ($st->fetchAll() as $t) {
        if (kos_period_of($t['check_in']) > $period) { $skipped++; continue; }
        if (!$t['due_day']) { $missing[] = ['tenant' => (int)$t['id'], 'name' => $t['name'], 'missing' => 'due_day']; continue; }
        if (kos_covered((int)$t['id'], $period)) { $skipped++; continue; }
        try { $b = kos_create_bill($t, $period, 1, $actor, $s); } catch (KosError $e) { if ($e->codeName === 'duplicate_period') { $skipped++; continue; } throw $e; }
        if ($b) $created[] = $b; else $skipped++;
    }
    kos_audit($actor, 'bill.generate', 'period', $period, ['created' => count($created), 'skipped' => $skipped, 'missing' => count($missing)]);
    $sent = [];
    if (!empty($s['send_on_generate'])) foreach ($created as $b) $sent[] = kos_wa_for_bill((int)$b['id'], 'issued', $actor);
    return ['period' => $period, 'created' => count($created), 'skipped' => $skipped, 'missing' => $missing, 'wa' => kos_wa_summary($sent)];
}

/** First month (from the current one or move-in, whichever is later) that is not billed yet. */
function kos_first_open_period(array $t): string
{
    $p = max(kos_period_of(kos_today()), kos_period_of($t['check_in']));
    for ($i = 0; $i < 600 && kos_covered((int)$t['id'], $p); $i++) $p = kos_period_add($p, 1);
    return $p;
}

function kos_prepay_quote(int $tenantId, int $months): array
{
    $t = kos_tenant($tenantId);
    if (!(int)$t['active']) kos_err(409, 'inactive', 'Penghuni sudah tidak aktif.');
    if (!$t['due_day']) kos_err(422, 'no_due_day', 'Tanggal jatuh tempo penghuni belum diisi.');
    $room = kos_room($t['room_id']);
    $q = kos_quote($room['type'], $months);
    $p = kos_first_open_period($t);
    [$start, $end] = kos_window($p, (int)$t['due_day'], $months);
    return $q + ['tenant' => (int)$t['id'], 'room' => $room['id'], 'period_start' => $p, 'period_end' => kos_period_add($p, $months - 1), 'start_date' => $start, 'end_date' => $end];
}

function kos_void_bill(int $billId, string $reason, array $actor): array
{
    return kos_tx(function (PDO $pdo) use ($billId, $reason, $actor) {
        $b = kos_bill($billId, true);
        if ($b['status'] !== 'open') kos_err(409, 'not_open', 'Hanya tagihan yang belum dibayar yang bisa dibatalkan.');
        if ((int)$b['paid'] > 0) kos_err(409, 'has_payment', 'Tagihan ini sudah menerima pembayaran, jadi tidak bisa dibatalkan.');
        $pdo->prepare("UPDATE kos_bills SET status = 'void', voided_at = ?, void_reason = ? WHERE id = ?")->execute([kos_now(), mb_substr($reason, 0, 200), $billId]);
        $pdo->prepare('DELETE FROM kos_bill_months WHERE bill_id = ?')->execute([$billId]);
        $pdo->prepare("UPDATE kos_payments SET status = 'expired', note = 'tagihan dibatalkan', updated_at = ? WHERE bill_id = ? AND status = 'pending'")->execute([kos_now(), $billId]);
        kos_audit($actor, 'bill.void', 'bill', $b['code'], ['reason' => $reason, 'total' => (int)$b['total']]);
        return kos_bill($billId);
    });
}

/* ---------------- tenants ---------------- */

function kos_checkin(array $in, array $actor): array
{
    $roomId = (string)($in['room'] ?? '');
    $name = kos_str($in['name'] ?? '', 2, 120, 'nama');
    $phone = kos_phone($in['phone'] ?? '');
    $job = kos_str($in['job'] ?? '', 0, 80, 'pekerjaan');
    $date = (string)($in['check_in'] ?? '');
    if (!kos_valid_date($date)) kos_err(422, 'bad_date', 'Tanggal masuk tidak valid.');
    if ($date > kos_add_days(kos_today(), 60)) kos_err(422, 'bad_date', 'Tanggal masuk paling lambat 60 hari dari hari ini.');
    $months = kos_int($in['months'] ?? 1, 1, 12, 'months');
    if (!in_array($months, KOS_MONTH_OPTIONS, true)) kos_err(422, 'bad_months', 'Lama pembayaran harus 1, 6, atau 12 bulan.');
    $source = in_array($in['source'] ?? '', ['admin', 'import'], true) ? $in['source'] : 'admin';
    $res = kos_tx(function (PDO $pdo) use ($roomId, $name, $phone, $job, $date, $months, $actor, $source) {
        $room = kos_room($roomId, true);
        if (!in_array($room['status'], ['Vacant', 'Reserved'], true)) kos_err(409, 'room_unavailable', 'Kamar ini tidak kosong.');
        $q = $pdo->prepare('SELECT 1 FROM kos_tenants WHERE active_room = ?'); $q->execute([$roomId]);
        if ($q->fetch()) kos_err(409, 'room_taken', 'Kamar ini masih punya penghuni aktif.');
        $now = kos_now();
        $day = (int)substr($date, 8, 2);
        $deposit = kos_price($room['type'])['sale'];
        $pdo->prepare('INSERT INTO kos_tenants (room_id, active_room, name, phone, job, check_in, due_day, deposit, active, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')
            ->execute([$roomId, $roomId, $name, $phone, $job, $date, $day, $deposit, $source, $now, $now]);
        $tid = (int)$pdo->lastInsertId();
        $pdo->prepare("UPDATE kos_rooms SET status = 'Occupied', updated_at = ? WHERE id = ?")->execute([$now, $roomId]);
        kos_audit($actor, 'tenant.checkin', 'tenant', kos_tenant_code($tid), ['room' => $roomId, 'check_in' => $date, 'phone_set' => $phone !== '', 'source' => $source]);
        $t = kos_tenant($tid);
        // Billing starts at the move-in month, or the current month for someone who moved in before the
        // system was used (earlier months are unknown and are never invented).
        $bill = kos_create_bill($t, max(kos_period_of($date), kos_period_of(kos_today())), $months, $actor);
        return ['tenant' => $t, 'bill' => $bill];
    });
    $wa = null;
    if (!empty($in['send_wa']) && $res['bill']) $wa = kos_wa_for_bill((int)$res['bill']['id'], 'issued', $actor);
    return $res + ['wa' => $wa];
}

function kos_tenant_update(int $id, array $in, array $actor): array
{
    return kos_tx(function (PDO $pdo) use ($id, $in, $actor) {
        $t = kos_tenant($id, true);
        $set = []; $vals = []; $changed = [];
        if (array_key_exists('name', $in)) { $set[] = 'name = ?'; $vals[] = kos_str($in['name'], 2, 120, 'nama'); $changed[] = 'name'; }
        if (array_key_exists('phone', $in)) { $set[] = 'phone = ?'; $vals[] = kos_phone($in['phone']); $changed[] = 'phone'; }
        if (array_key_exists('job', $in)) { $set[] = 'job = ?'; $vals[] = kos_str($in['job'], 0, 80, 'pekerjaan'); $changed[] = 'job'; }
        if (array_key_exists('due_day', $in)) { $set[] = 'due_day = ?'; $vals[] = kos_int($in['due_day'], 1, 31, 'due_day'); $changed[] = 'due_day'; }
        if (!$set) kos_err(422, 'nothing', 'Tidak ada perubahan.');
        $set[] = 'updated_at = ?'; $vals[] = kos_now(); $vals[] = $id;
        $pdo->prepare('UPDATE kos_tenants SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($vals);
        kos_audit($actor, 'tenant.update', 'tenant', kos_tenant_code($id), ['fields' => $changed]);
        return kos_tenant($id);
    });
}

/** Ends a tenancy. The tenant becomes inactive and the room is released; the tenant's bills stay attached to
    them (for audit and reports) and are never shown as the next tenant's history. Unpaid bills for months after
    the move-out month are cancelled. Prepaid months after move-out are reported, never refunded automatically. */
function kos_checkout(int $tenantId, string $date, array $actor): array
{
    if (!kos_valid_date($date)) kos_err(422, 'bad_date', 'Tanggal keluar tidak valid.');
    $s = kos_settings();
    return kos_tx(function (PDO $pdo) use ($tenantId, $date, $actor, $s) {
        $t = kos_tenant($tenantId, true);
        if (!(int)$t['active']) kos_err(409, 'inactive', 'Penghuni ini sudah checkout.');
        if ($date < $t['check_in']) kos_err(422, 'bad_date', 'Tanggal keluar tidak boleh sebelum tanggal masuk.');
        if ($date > kos_today()) kos_err(422, 'bad_date', 'Tanggal keluar tidak boleh di masa depan.');
        $now = kos_now();
        $after = kos_period_of($date);
        $voided = [];
        $st = $pdo->prepare("SELECT * FROM kos_bills WHERE tenant_id = ? AND status = 'open' AND paid = 0 AND period_start > ?");
        $st->execute([$tenantId, $after]);
        foreach ($st->fetchAll() as $b) { kos_void_bill((int)$b['id'], 'checkout ' . $date, $actor); $voided[] = $b['code']; }
        // Months already paid beyond the move-out month (from a prepayment): reported for the refund decision.
        $st = $pdo->prepare("SELECT bm.period, b.sale_price, b.discount_amount, b.months, b.code FROM kos_bill_months bm JOIN kos_bills b ON b.id = bm.bill_id WHERE bm.tenant_id = ? AND bm.period > ? AND b.status = 'paid'");
        $st->execute([$tenantId, $after]);
        $prepaid = $st->fetchAll();
        $value = 0; foreach ($prepaid as $p) $value += (int)$p['sale_price'] - intdiv((int)$p['discount_amount'], max(1, (int)$p['months']));
        $pdo->prepare('UPDATE kos_tenants SET active = 0, active_room = NULL, check_out = ?, updated_at = ? WHERE id = ?')->execute([$date, $now, $tenantId]);
        $pdo->prepare("UPDATE kos_rooms SET status = 'Vacant', updated_at = ? WHERE id = ?")->execute([$now, $t['room_id']]);
        $open = $pdo->prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total - paid), 0) AS owed FROM kos_bills WHERE tenant_id = ? AND status = 'open'");
        $open->execute([$tenantId]); $o = $open->fetch();
        $info = ['room' => $t['room_id'], 'date' => $date, 'voided' => $voided, 'prepaid_months_after' => count($prepaid), 'prepaid_value_after' => $value, 'open_bills' => (int)$o['n'], 'owed' => (int)$o['owed'], 'refund_policy' => (string)$s['refund_policy'], 'refund' => 'none_automatic'];
        kos_audit($actor, 'tenant.checkout', 'tenant', kos_tenant_code($tenantId), $info);
        return $info;
    });
}

function kos_room_status(string $roomId, string $status, array $actor): array
{
    if (!in_array($status, ['Vacant', 'Maintenance', 'Reserved'], true)) kos_err(422, 'bad_status', 'Status kamar tidak valid.');
    return kos_tx(function (PDO $pdo) use ($roomId, $status, $actor) {
        $r = kos_room($roomId, true);
        if ($r['status'] === 'Occupied') kos_err(409, 'occupied', 'Kamar masih berpenghuni. Proses checkout dulu.');
        $pdo->prepare('UPDATE kos_rooms SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, kos_now(), $roomId]);
        kos_audit($actor, 'room.status', 'room', $roomId, ['from' => $r['status'], 'to' => $status]);
        return kos_room($roomId);
    });
}

/* ---------------- payments ---------------- */

function kos_public_base(): string
{
    $env = rtrim(kos_env('PUBLIC_BASE_URL'), '/');
    if ($env !== '') return $env;
    $s = kos_settings();
    return rtrim((string)($s['public_base_url'] ?? ''), '/');
}
/** Remembers this site's address (from an admin's browser request) so cron and WhatsApp messages can build links. */
function kos_learn_base(): void
{
    if (PHP_SAPI === 'cli' || kos_env('PUBLIC_BASE_URL') !== '') return;
    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (!preg_match('/^[A-Za-z0-9.\-]+(:\d+)?$/', $host)) return;
    $dir = rtrim(str_replace('\\', '/', dirname(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api/x.php')))), '/');
    $url = (kb_https() ? 'https://' : 'http://') . $host . $dir;
    if ((kos_settings()['public_base_url'] ?? '') !== $url) kos_setting_put('public_base_url', $url);
}
function kos_pay_url(string $token): string { $b = kos_public_base(); return ($b !== '' ? $b : '') . '/api/pay.php?t=' . $token; }

/** Expires pending links whose time is up. */
function kos_expire_links(): int
{
    $st = kb_db()->prepare("UPDATE kos_payments SET status = 'expired', updated_at = ? WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?");
    $st->execute([kos_now(), kos_now()]);
    return $st->rowCount();
}

/** One payment link per bill at a time, for the full remaining balance. Re-uses a link that is still valid. */
function kos_paylink(int $billId, array $actor): array
{
    kos_expire_links();
    $driver = kos_payment_driver();
    return kos_tx(function (PDO $pdo) use ($billId, $actor, $driver) {
        $b = kos_bill($billId, true);
        if ($b['status'] !== 'open') kos_err(409, 'not_open', $b['status'] === 'paid' ? 'Tagihan ini sudah lunas.' : 'Tagihan ini sudah dibatalkan.');
        $balance = (int)$b['total'] - (int)$b['paid'];
        if ($balance <= 0) kos_err(409, 'not_open', 'Tagihan ini sudah lunas.');
        $st = $pdo->prepare("SELECT * FROM kos_payments WHERE bill_id = ? AND status = 'pending' ORDER BY id DESC");
        $st->execute([$billId]);
        foreach ($st->fetchAll() as $p) {
            if ((int)$p['amount'] === $balance && $p['gateway'] === $driver['name']) return ['payment' => $p, 'url' => kos_pay_url($p['token']), 'reused' => true];
            $pdo->prepare("UPDATE kos_payments SET status = 'expired', note = 'diganti link baru', updated_at = ? WHERE id = ?")->execute([kos_now(), $p['id']]);
        }
        if (!$driver['ready']) kos_err(503, 'gateway_not_ready', $driver['note']);
        $token = bin2hex(random_bytes(20));
        $ttl = max(1, min(720, (int)(kos_settings()['link_ttl_hours'] ?? 72)));
        $expires = (new DateTimeImmutable(kos_now()))->modify("+$ttl hour")->format('Y-m-d H:i:s');
        $now = kos_now();
        $pdo->prepare('INSERT INTO kos_payments (bill_id, tenant_id, gateway, token, amount, status, method, expires_at, actor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$billId, $b['tenant_id'], $driver['name'], $token, $balance, 'pending', '', $expires, $actor['username'] ?? 'system', $now, $now]);
        $pid = (int)$pdo->lastInsertId();
        $checkout = kos_gateway_create_checkout($driver['name'], ['id' => $pid, 'token' => $token, 'amount' => $balance, 'expires_at' => $expires], $b, kos_tenant((int)$b['tenant_id']));
        $pdo->prepare('UPDATE kos_payments SET checkout_url = ?, ref = ? WHERE id = ?')->execute([$checkout['checkout_url'] ?? null, $checkout['ref'] ?? null, $pid]);
        kos_audit($actor, 'payment.link', 'bill', $b['code'], ['payment' => $pid, 'gateway' => $driver['name'], 'amount' => $balance, 'expires' => $expires]);
        $p = $pdo->prepare('SELECT * FROM kos_payments WHERE id = ?'); $p->execute([$pid]);
        return ['payment' => $p->fetch(), 'url' => kos_pay_url($token), 'reused' => false];
    });
}

/** Adds money to a bill. When the bill becomes fully paid: lease is extended and commissions recorded. */
function kos_apply_to_bill(array $b, int $amount, array $actor, int $paymentId): array
{
    $pdo = kb_db();
    $balance = (int)$b['total'] - (int)$b['paid'];
    if ($b['status'] !== 'open' || $balance <= 0) return ['applied' => 0, 'excess' => $amount, 'paid_off' => false];
    $applied = min($amount, $balance);
    $paid = (int)$b['paid'] + $applied;
    $full = $paid >= (int)$b['total'];
    $pdo->prepare('UPDATE kos_bills SET paid = ?, status = ?, paid_at = ? WHERE id = ?')->execute([$paid, $full ? 'paid' : 'open', $full ? kos_now() : null, $b['id']]);
    // Any other link for this bill would now ask for the wrong amount (or for a paid bill): retire it.
    $pdo->prepare("UPDATE kos_payments SET status = 'expired', note = 'saldo tagihan berubah', updated_at = ? WHERE bill_id = ? AND status = 'pending' AND id <> ?")->execute([kos_now(), $b['id'], $paymentId]);
    if ($full) {
        $t = kos_tenant((int)$b['tenant_id'], true);
        if (!$t['paid_until'] || $t['paid_until'] < $b['end_date']) $pdo->prepare('UPDATE kos_tenants SET paid_until = ?, updated_at = ? WHERE id = ?')->execute([$b['end_date'], kos_now(), $t['id']]);
        if ($b['profit_model'] === 'commission') {
            $amt = (int)(kos_settings()['commission_amount'] ?? 5000);
            $months = $pdo->prepare('SELECT period FROM kos_bill_months WHERE bill_id = ?'); $months->execute([$b['id']]);
            $ins = $pdo->prepare('INSERT INTO kos_commissions (tenant_id, period, bill_id, amount, created_at) VALUES (?, ?, ?, ?, ?)');
            foreach ($months->fetchAll() as $m) {
                $c = $pdo->prepare('SELECT 1 FROM kos_commissions WHERE tenant_id = ? AND period = ?'); $c->execute([$b['tenant_id'], $m['period']]);
                if (!$c->fetch()) $ins->execute([$b['tenant_id'], $m['period'], $b['id'], $amt, kos_now()]);
            }
        }
        kos_audit($actor, 'bill.paid', 'bill', $b['code'], ['total' => (int)$b['total'], 'lease_until' => $b['end_date']]);
    }
    return ['applied' => $applied, 'excess' => $amount - $applied, 'paid_off' => $full];
}

function kos_pay_manual(int $billId, $amountIn, string $method, string $date, array $actor): array
{
    $amount = kos_int($amountIn, 1000, 1000000000, 'amount');
    if (!in_array($method, KOS_PAY_METHODS, true)) kos_err(422, 'bad_method', 'Metode pembayaran tidak dikenal.');
    if (!kos_valid_date($date) || $date > kos_today()) kos_err(422, 'bad_date', 'Tanggal bayar tidak valid atau di masa depan.');
    return kos_tx(function (PDO $pdo) use ($billId, $amount, $method, $date, $actor) {
        $b = kos_bill($billId, true);
        if ($b['status'] !== 'open') kos_err(409, 'not_open', 'Tagihan ini sudah lunas atau dibatalkan.');
        $balance = (int)$b['total'] - (int)$b['paid'];
        if ($amount > $balance) kos_err(422, 'over_balance', 'Jumlah melebihi sisa tagihan ' . kos_rp($balance) . '.', ['balance' => $balance]);
        $now = kos_now();
        $ref = 'MAN-' . strtoupper(bin2hex(random_bytes(5)));
        $pdo->prepare('INSERT INTO kos_payments (bill_id, tenant_id, gateway, ref, amount, status, method, actor, created_at, updated_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$billId, $b['tenant_id'], 'manual', $ref, $amount, 'success', $method, $actor['username'], $now, $now, $date . ' 12:00:00']);
        $pid = (int)$pdo->lastInsertId();
        $r = kos_apply_to_bill($b, $amount, $actor, $pid);
        kos_audit($actor, 'payment.manual', 'bill', $b['code'], ['payment' => $ref, 'amount' => $amount, 'method' => $method, 'date' => $date]);
        return ['ref' => $ref, 'bill' => kos_bill($billId)] + $r;
    });
}

/**
 * Handles a verified gateway notification (already normalised by the gateway adapter):
 *   ['ref' => gateway transaction id, 'token' => our payment token, 'status' => success|failed|expired|pending, 'amount' => int, 'method' => string]
 * Safe to receive more than once. A success never gets downgraded, the amount must match the link,
 * and money arriving for a bill that is already paid is recorded and flagged instead of counted twice.
 */
function kos_process_notification(string $gateway, array $n): array
{
    $actor = ['username' => 'gateway:' . $gateway, 'role' => 'system'];
    return kos_tx(function (PDO $pdo) use ($gateway, $n, $actor) {
        $st = $pdo->prepare('SELECT * FROM kos_payments WHERE token = ? AND gateway = ?' . kos_lock());
        $st->execute([(string)$n['token'], $gateway]);
        $p = $st->fetch();
        if (!$p) return ['result' => 'unknown_payment', 'http' => 404];
        if ((int)$n['amount'] !== (int)$p['amount']) {
            kos_audit($actor, 'payment.mismatch', 'payment', (string)$p['id'], ['expected' => (int)$p['amount'], 'got' => (int)$n['amount'], 'ref' => $n['ref']]);
            return ['result' => 'amount_mismatch', 'http' => 422];
        }
        if ($p['status'] === 'success') return ['result' => 'already_success', 'http' => 200];
        $now = kos_now();
        $status = $n['status'];
        if ($status === 'pending') return ['result' => 'still_pending', 'http' => 200];
        if ($status === 'failed' || $status === 'expired') {
            $pdo->prepare('UPDATE kos_payments SET status = ?, ref = COALESCE(?, ref), updated_at = ? WHERE id = ?')->execute([$status, $n['ref'] ?: null, $now, $p['id']]);
            kos_audit($actor, 'payment.' . $status, 'payment', (string)$p['id'], ['ref' => $n['ref'], 'amount' => (int)$p['amount']]);
            return ['result' => $status, 'http' => 200];
        }
        // success
        $b = kos_bill((int)$p['bill_id'], true);
        try {
            $pdo->prepare("UPDATE kos_payments SET status = 'success', ref = ?, method = ?, paid_at = ?, updated_at = ? WHERE id = ?")->execute([$n['ref'], mb_substr((string)($n['method'] ?? ''), 0, 40), $now, $now, $p['id']]);
        } catch (PDOException $e) {
            return ['result' => 'duplicate_ref', 'http' => 409]; // the same gateway transaction id was already used by another payment
        }
        $r = kos_apply_to_bill($b, (int)$p['amount'], $actor, (int)$p['id']);
        if ($r['excess'] > 0) {
            $pdo->prepare('UPDATE kos_payments SET note = ? WHERE id = ?')->execute(['kelebihan bayar ' . kos_rp($r['excess']) . ' — perlu ditindaklanjuti admin', $p['id']]);
            kos_audit($actor, 'payment.excess', 'bill', $b['code'], ['payment' => (int)$p['id'], 'excess' => $r['excess'], 'ref' => $n['ref']]);
        }
        kos_audit($actor, 'payment.success', 'bill', $b['code'], ['payment' => (int)$p['id'], 'ref' => $n['ref'], 'amount' => (int)$p['amount'], 'applied' => $r['applied']]);
        return ['result' => $r['excess'] > 0 ? 'success_excess' : 'success', 'http' => 200, 'paid_off' => $r['paid_off']];
    });
}

/** Entry point for webhook.php: verify signature, log the event once, then process it. */
function kos_handle_webhook(string $gateway, string $raw, array $headers): array
{
    $hash = hash('sha256', $gateway . "\n" . $raw);
    $v = kos_gateway_verify($gateway, $raw, $headers); // ['ok' => bool, 'event' => normalised|null, 'reason' => string]
    $pdo = kb_db();
    // Only accepted deliveries count as "already received"; a rejected one (bad signature) never blocks the real one.
    $dup = $pdo->prepare('SELECT result FROM kos_webhook_events WHERE payload_hash = ? AND signature_ok = 1'); $dup->execute([$hash]);
    if ($row = $dup->fetch()) return ['http' => 200, 'result' => 'duplicate_delivery', 'first' => $row['result']];
    $ev = $v['event'] ?? null;
    $log = function (string $result) use ($pdo, $gateway, $hash, $ev, $v) {
        if (!$v['ok']) $hash = hash('sha256', 'rejected:' . bin2hex(random_bytes(16)));
        try {
            $pdo->prepare('INSERT INTO kos_webhook_events (gateway, payload_hash, ref, token, event_status, amount, signature_ok, result, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$gateway, $hash, $ev['ref'] ?? null, $ev['token'] ?? null, $ev['status'] ?? null, isset($ev['amount']) ? (int)$ev['amount'] : null, $v['ok'] ? 1 : 0, $result, kos_now()]);
        } catch (PDOException $e) { /* a parallel delivery logged it first */ }
    };
    if (!$v['ok']) { $log('rejected:' . ($v['reason'] ?? 'signature')); return ['http' => $v['http'] ?? 401, 'result' => 'rejected', 'reason' => $v['reason'] ?? 'signature']; }
    $r = kos_process_notification($gateway, $ev);
    $log($r['result']);
    return $r;
}

/* ---------------- WhatsApp ---------------- */

function kos_bill_status_label(array $b): string
{
    if ($b['status'] === 'paid') return 'Lunas';
    if ($b['status'] === 'void') return 'Dibatalkan';
    $d = kos_days_between(kos_today(), $b['due_date']);
    if ($d < 0) return 'Terlambat ' . (-$d) . ' hari';
    if ((int)$b['paid'] > 0) return 'Dibayar sebagian';
    return 'Belum dibayar';
}
function kos_bill_message(array $b, array $t, string $kind, ?string $url, ?string $expires): string
{
    $s = kos_settings();
    $d = kos_days_between(kos_today(), $b['due_date']);
    $head = [
        'issued' => 'Tagihan sewa kamar Anda sudah terbit.',
        'resend' => 'Berikut tagihan sewa kamar Anda.',
    ][$kind] ?? ($d > 0 ? "Pengingat: tagihan jatuh tempo $d hari lagi." : ($d === 0 ? 'Pengingat: tagihan jatuh tempo hari ini.' : 'Pengingat: tagihan sudah lewat jatuh tempo ' . (-$d) . ' hari.'));
    $period = (int)$b['months'] > 1
        ? kos_period_label($b['period_start']) . ' – ' . kos_period_label($b['period_end']) . ' (' . (int)$b['months'] . ' bulan)'
        : kos_period_label($b['period_start']);
    $lines = [
        'Halo ' . $t['name'] . ',',
        $head,
        '',
        'Kos: ' . $s['property_name'],
        'Kamar: ' . $b['room_id'] . ' (' . $b['room_type'] . ')',
        'Periode: ' . $period,
        'Masa sewa: ' . kos_date_label($b['start_date']) . ' – ' . kos_date_label($b['end_date']),
        'Jumlah: ' . kos_rp((int)$b['total'] - (int)$b['paid']) . ((int)$b['discount_amount'] > 0 ? ' (sudah termasuk diskon ' . kos_rp((int)$b['discount_amount']) . ')' : ''),
        'Jatuh tempo: ' . kos_date_label($b['due_date']),
        'Status: ' . kos_bill_status_label($b),
    ];
    if ($url) { $lines[] = ''; $lines[] = 'Bayar lewat link berikut: ' . $url; if ($expires) $lines[] = 'Link berlaku sampai ' . kos_date_label($expires) . ' ' . substr($expires, 11, 5) . ' WIB.'; }
    else { $lines[] = ''; $lines[] = 'Link pembayaran online belum tersedia. Silakan hubungi pengelola untuk cara pembayaran.'; }
    $lines[] = 'Abaikan pesan ini jika Anda sudah membayar. Terima kasih.';
    return implode("\n", $lines);
}

/** Sends (or simulates) the bill message for a bill. $kind: issued | before_N | due_0 | after_N | resend.
    Automatic kinds are sent at most once per bill (dedupe key); "resend" is a deliberate admin action. */
function kos_wa_for_bill(int $billId, string $kind, array $actor): array
{
    $b = kos_bill($billId);
    $t = kos_tenant((int)$b['tenant_id']);
    if ($b['status'] !== 'open' && $kind !== 'resend') return ['status' => 'skipped', 'reason' => 'bill_' . $b['status']];
    if (!kos_phone_ok($t['phone'])) return ['status' => 'skipped', 'reason' => 'no_phone', 'tenant' => (int)$t['id']];
    $dedupe = $kind === 'resend' ? null : "bill:{$b['id']}:$kind";
    $pdo = kb_db();
    if ($dedupe) { $q = $pdo->prepare('SELECT id FROM kos_wa_messages WHERE dedupe = ?'); $q->execute([$dedupe]); if ($q->fetch()) return ['status' => 'duplicate', 'reason' => 'already_sent']; }
    if ($kind === 'resend') {
        $q = $pdo->prepare("SELECT created_at FROM kos_wa_messages WHERE bill_id = ? AND kind = 'resend' ORDER BY id DESC LIMIT 1"); $q->execute([$billId]);
        $last = $q->fetch();
        if ($last && strtotime(kos_now()) - strtotime($last['created_at']) < 60) kos_err(429, 'too_soon', 'Tunggu 1 menit sebelum mengirim ulang pesan untuk tagihan yang sama.');
    }
    $url = null; $expires = null; $linkNote = null;
    if ($b['status'] === 'open') {
        try { $l = kos_paylink($billId, $actor); $url = $l['url']; $expires = $l['payment']['expires_at']; }
        catch (KosError $e) { $linkNote = $e->getMessage(); }
    }
    $body = kos_bill_message($b, $t, $kind, $url, $expires);
    // Reserve the dedupe key first so two runs at the same moment cannot both send.
    try {
        $pdo->prepare('INSERT INTO kos_wa_messages (tenant_id, bill_id, kind, dedupe, to_phone, body, driver, status, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$t['id'], $billId, $kind, $dedupe, $t['phone'], $body, kos_wa_driver()['name'], 'queued', $actor['username'] ?? 'system', kos_now()]);
    } catch (PDOException $e) { return ['status' => 'duplicate', 'reason' => 'already_sent']; }
    $mid = (int)$pdo->lastInsertId();
    $res = kos_wa_send(kos_wa_number($t['phone']), $body, ['name' => $t['name'], 'room' => $b['room_id'], 'period' => kos_period_label($b['period_start']), 'amount' => kos_rp((int)$b['total'] - (int)$b['paid']), 'due' => kos_date_label($b['due_date']), 'status' => kos_bill_status_label($b), 'link' => $url ?? '-']);
    $pdo->prepare('UPDATE kos_wa_messages SET status = ?, provider_id = ?, error = ?, driver = ? WHERE id = ?')->execute([$res['status'], $res['id'] ?? null, $res['error'] ?? $linkNote, $res['driver'], $mid]);
    kos_audit($actor, 'wa.' . $res['status'], 'bill', $b['code'], ['kind' => $kind, 'message' => $mid, 'driver' => $res['driver'], 'link' => (bool)$url]);
    return ['status' => $res['status'], 'message' => $mid, 'driver' => $res['driver'], 'link' => $url, 'error' => $res['error'] ?? $linkNote];
}
function kos_wa_summary(array $list): array
{
    $out = [];
    foreach ($list as $r) { $k = $r['status'] . (isset($r['reason']) ? ':' . $r['reason'] : ''); $out[$k] = ($out[$k] ?? 0) + 1; }
    return $out;
}

/** Due-date reminders for open bills of active tenants, following the configured schedule. */
function kos_run_reminders(array $actor): array
{
    kos_expire_links();
    $s = kos_settings();
    $before = array_values(array_filter(array_map('intval', (array)$s['reminders_before']), fn($d) => $d >= 0 && $d <= 60));
    $after = array_values(array_filter(array_map('intval', (array)$s['reminders_after']), fn($d) => $d > 0 && $d <= 90));
    $today = kos_today();
    $st = kb_db()->query("SELECT b.id, b.due_date FROM kos_bills b JOIN kos_tenants t ON t.id = b.tenant_id WHERE b.status = 'open' AND t.active = 1 ORDER BY b.due_date");
    $res = [];
    foreach ($st->fetchAll() as $b) {
        $d = kos_days_between($today, $b['due_date']);
        $kind = null;
        if ($d >= 0 && in_array($d, $before, true)) $kind = $d === 0 ? 'due_0' : "before_$d";
        elseif ($d < 0 && in_array(-$d, $after, true)) $kind = 'after_' . (-$d);
        if ($kind) $res[] = kos_wa_for_bill((int)$b['id'], $kind, $actor);
    }
    $sum = kos_wa_summary($res);
    kos_audit($actor, 'wa.reminders', 'run', $today, ['checked' => count($res), 'result' => $sum]);
    return ['date' => $today, 'considered' => count($res), 'result' => $sum];
}

/** Daily job (cron.php): expire old links, bill the current month on/after the 1st, send reminders. */
function kos_daily(array $actor): array
{
    $period = kos_period_of(kos_today());
    return ['expired_links' => kos_expire_links(), 'generate' => kos_generate($period, $actor), 'reminders' => kos_run_reminders($actor)];
}

/* ---------------- state for the dashboard ---------------- */

function kos_state(array $user): array
{
    kos_expire_links();
    $pdo = kb_db();
    $admin = $user['role'] === 'admin';
    $s = kos_settings();
    $bases = kos_base_prices();
    $types = [];
    foreach (KOS_TYPES as $t) $types[] = kos_price($t, $s, $bases);
    $since = kos_period_add(kos_period_of(kos_today()), -24);
    $rooms = $pdo->query('SELECT id, block, floor, num, type, status FROM kos_rooms ORDER BY id')->fetchAll();
    $cols = $admin ? 'id, room_id, name, phone, job, check_in, check_out, due_day, deposit, active, paid_until, source' : 'id, room_id, name, check_in, check_out, due_day, active, paid_until';
    $tenants = $pdo->query("SELECT $cols FROM kos_tenants ORDER BY id")->fetchAll();
    $st = $pdo->prepare("SELECT * FROM kos_bills WHERE status <> 'void' AND (period_end >= ? OR status = 'open') ORDER BY id");
    $st->execute([$since]);
    $bills = $st->fetchAll();
    $pays = $pdo->prepare("SELECT p.id, p.bill_id, p.tenant_id, p.gateway, p.ref, p.amount, p.status, p.method, p.paid_at, p.created_at, p.expires_at, p.note, b.code, b.room_id FROM kos_payments p JOIN kos_bills b ON b.id = p.bill_id WHERE p.status = 'success' AND p.paid_at >= ? ORDER BY p.paid_at DESC, p.id DESC");
    $pays->execute([$since . '-01']);
    $out = [
        'ok' => true, 'role' => $user['role'], 'username' => $user['username'], 'today' => kos_today(),
        'settings' => ['property_name' => $s['property_name'], 'profit_model' => $s['profit_model'], 'commission_amount' => (int)$s['commission_amount']],
        'types' => $types, 'rooms' => $rooms, 'tenants' => $tenants, 'bills' => $bills, 'trx' => $pays->fetchAll(),
        'commissions' => $pdo->query('SELECT period, COUNT(*) AS n, SUM(amount) AS total FROM kos_commissions GROUP BY period ORDER BY period DESC')->fetchAll(),
    ];
    if ($admin) {
        $out['settings'] = $s; unset($out['settings']['sim_secret'], $out['settings']['schema']);
        $out['payments'] = $pdo->query('SELECT p.*, b.code, b.room_id FROM kos_payments p JOIN kos_bills b ON b.id = p.bill_id ORDER BY p.id DESC LIMIT 300')->fetchAll();
        foreach ($out['payments'] as &$p) { $p['url'] = $p['token'] ? kos_pay_url($p['token']) : null; unset($p['token']); } unset($p);
        $out['wa'] = $pdo->query('SELECT * FROM kos_wa_messages ORDER BY id DESC LIMIT 300')->fetchAll();
        $out['webhooks'] = $pdo->query('SELECT * FROM kos_webhook_events ORDER BY id DESC LIMIT 100')->fetchAll();
        $out['audit'] = $pdo->query('SELECT * FROM kos_audit ORDER BY id DESC LIMIT 400')->fetchAll();
        $out['commission_rows'] = $pdo->query('SELECT c.*, t.name, t.room_id FROM kos_commissions c JOIN kos_tenants t ON t.id = c.tenant_id ORDER BY c.id DESC LIMIT 500')->fetchAll();
        $out['users'] = $pdo->query('SELECT id, username, role, created_at, updated_at FROM kb_admins ORDER BY id')->fetchAll();
        $out['integration'] = ['payment' => kos_payment_driver(), 'wa' => kos_wa_driver(), 'cron' => kos_env('CRON_KEY') !== '' && strlen(kos_env('CRON_KEY')) >= 24, 'base_url' => kos_public_base()];
        $out['methods'] = KOS_PAY_METHODS;
    }
    return $out;
}

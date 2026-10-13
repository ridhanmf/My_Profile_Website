<?php
/**
 * KostBills operational API.
 *   GET  ?action=public                  anyone   → { demo_enabled }
 *   GET  ?action=state                   admin, management (management gets no phone numbers, logs or settings)
 *   POST ?action=<name>  (X-CSRF-Token)  admin only — management and visitors are refused here, on the server.
 * Every change is validated here, runs in a database transaction and is written to the audit log.
 */
declare(strict_types=1);
require __DIR__ . '/_kos.php';

$action = (string)($_GET['action'] ?? '');

try {
    kos_ensure_schema();

    if (kb_method() === 'GET') {
        if ($action === 'public') kb_json(200, ['ok' => true, 'demo_enabled' => (bool)kos_settings()['demo_enabled'], 'server' => true]);
        if ($action === 'state') {
            $u = kb_user();
            if (!$u) kb_fail(401, 'not_signed_in', 'Masuk sebagai Admin atau Management terlebih dahulu.');
            if ($u['role'] === 'admin') kos_learn_base();
            kb_json(200, kos_state($u));
        }
        kb_fail(400, 'unknown_action', 'Unknown action.');
    }
    if (kb_method() !== 'POST') kb_fail(405, 'method', 'Use GET or POST.');

    $u = kb_require_role(['admin']);
    kos_learn_base();
    $in = kb_body();
    $s = kos_settings();

    switch ($action) {
        case 'settings': {
            $changes = [];
            $old = $s;
            if (array_key_exists('profit_model', $in)) {
                if (!in_array($in['profit_model'], ['commission', 'markup'], true)) kos_err(422, 'bad_model', 'Model keuntungan harus commission atau markup.');
                $changes['profit_model'] = $in['profit_model'];
            }
            if (array_key_exists('commission_amount', $in)) $changes['commission_amount'] = kos_int($in['commission_amount'], 0, 1000000, 'commission_amount');
            if (array_key_exists('markup', $in)) {
                if (!is_array($in['markup'])) kos_err(422, 'bad_markup', 'Markup tidak valid.');
                $m = [];
                foreach (KOS_TYPES as $t) $m[$t] = kos_int($in['markup'][$t] ?? ($s['markup'][$t] ?? 0), 0, 10000000, 'markup');
                $changes['markup'] = $m;
            }
            if (array_key_exists('discount_pct', $in)) {
                if (!is_array($in['discount_pct'])) kos_err(422, 'bad_discount', 'Diskon tidak valid.');
                $d = [];
                foreach (['6', '12'] as $k) {
                    $v = $in['discount_pct'][$k] ?? 0;
                    if (!is_numeric($v) || $v < 0 || $v > 50) kos_err(422, 'bad_discount', 'Diskon harus 0–50%.');
                    $d[$k] = (int)round(((float)$v) * 100);
                }
                $changes['discount_bp'] = $d;
            }
            foreach (['reminders_before' => [0, 60], 'reminders_after' => [1, 90]] as $k => [$lo, $hi]) {
                if (!array_key_exists($k, $in)) continue;
                if (!is_array($in[$k]) || count($in[$k]) > 6) kos_err(422, 'bad_' . $k, 'Jadwal pengingat maksimal 6 hari.');
                $vals = array_map(fn($x) => kos_int($x, $lo, $hi, $k), $in[$k]);
                $vals = array_values(array_unique($vals)); rsort($vals);
                $changes[$k] = $vals;
            }
            if (array_key_exists('send_on_generate', $in)) $changes['send_on_generate'] = (bool)$in['send_on_generate'];
            if (array_key_exists('link_ttl_hours', $in)) $changes['link_ttl_hours'] = kos_int($in['link_ttl_hours'], 1, 720, 'link_ttl_hours');
            if (array_key_exists('refund_policy', $in)) $changes['refund_policy'] = kos_str($in['refund_policy'], 10, 1000, 'kebijakan refund');
            if (array_key_exists('demo_enabled', $in)) $changes['demo_enabled'] = (bool)$in['demo_enabled'];
            if (array_key_exists('property_name', $in)) $changes['property_name'] = kos_str($in['property_name'], 2, 80, 'nama properti');
            if (!$changes) kos_err(422, 'nothing', 'Tidak ada perubahan.');
            kos_tx(function () use ($changes, $old, $u) {
                foreach ($changes as $k => $v) kos_setting_put($k, $v);
                $diff = [];
                foreach ($changes as $k => $v) if (($old[$k] ?? null) !== $v) $diff[$k] = ['from' => $old[$k] ?? null, 'to' => $v];
                kos_audit($u, 'settings.update', 'settings', 'kos', $diff);
            });
            kb_json(200, ['ok' => true, 'note' => 'Perubahan harga dan model hanya berlaku untuk tagihan baru.']);
        }
        case 'price': {
            // Changing the BASE price of a room class. Markup lives in settings and never touches this table.
            $type = (string)($in['type'] ?? '');
            if (!in_array($type, KOS_TYPES, true)) kos_err(422, 'bad_type', 'Kelas kamar tidak dikenal.');
            $price = kos_int($in['base_price'] ?? null, 100000, 100000000, 'base_price');
            kos_tx(function (PDO $pdo) use ($type, $price, $u) {
                $old = kos_base_prices()[$type] ?? null;
                $pdo->prepare('UPDATE kos_room_types SET base_price = ?, updated_at = ? WHERE type = ?')->execute([$price, kb_now(), $type]);
                kos_audit($u, 'price.base', 'room_type', $type, ['from' => $old, 'to' => $price]);
            });
            kb_json(200, ['ok' => true]);
        }
        case 'room_status':
            kb_json(200, ['ok' => true, 'room' => kos_room_status((string)($in['room'] ?? ''), (string)($in['status'] ?? ''), $u)]);
        case 'checkin':
            kb_json(200, ['ok' => true] + kos_checkin($in, $u));
        case 'tenant_update':
            kb_json(200, ['ok' => true, 'tenant' => kos_tenant_update(kos_int($in['tenant_id'] ?? null, 1, PHP_INT_MAX, 'tenant_id'), (array)($in['fields'] ?? []), $u)]);
        case 'checkout':
            kb_json(200, ['ok' => true] + kos_checkout(kos_int($in['tenant_id'] ?? null, 1, PHP_INT_MAX, 'tenant_id'), (string)($in['date'] ?? kos_today()), $u));
        case 'generate':
            kb_json(200, ['ok' => true] + kos_generate((string)($in['period'] ?? ''), $u));
        case 'prepay_quote':
            kb_json(200, ['ok' => true, 'quote' => kos_prepay_quote(kos_int($in['tenant_id'] ?? null, 1, PHP_INT_MAX, 'tenant_id'), kos_int($in['months'] ?? null, 1, 12, 'months'))]);
        case 'prepay_create': {
            $tid = kos_int($in['tenant_id'] ?? null, 1, PHP_INT_MAX, 'tenant_id');
            $months = kos_int($in['months'] ?? null, 1, 12, 'months');
            $q = kos_prepay_quote($tid, $months);
            $b = kos_create_bill(kos_tenant($tid), $q['period_start'], $months, $u);
            if (!$b) kos_err(409, 'duplicate_period', 'Sebagian periode itu sudah ditagihkan. Muat ulang lalu coba lagi.');
            $wa = !empty($in['send_wa']) ? kos_wa_for_bill((int)$b['id'], 'issued', $u) : null;
            kb_json(200, ['ok' => true, 'bill' => $b, 'quote' => $q, 'wa' => $wa]);
        }
        case 'pay_manual':
            kb_json(200, ['ok' => true] + kos_pay_manual(kos_int($in['bill_id'] ?? null, 1, PHP_INT_MAX, 'bill_id'), $in['amount'] ?? null, (string)($in['method'] ?? ''), (string)($in['date'] ?? ''), $u));
        case 'void_bill':
            kb_json(200, ['ok' => true, 'bill' => kos_void_bill(kos_int($in['bill_id'] ?? null, 1, PHP_INT_MAX, 'bill_id'), kos_str($in['reason'] ?? '', 3, 200, 'alasan'), $u)]);
        case 'paylink': {
            $r = kos_paylink(kos_int($in['bill_id'] ?? null, 1, PHP_INT_MAX, 'bill_id'), $u);
            kb_json(200, ['ok' => true, 'url' => $r['url'], 'reused' => $r['reused'], 'expires_at' => $r['payment']['expires_at'], 'gateway' => $r['payment']['gateway']]);
        }
        case 'wa_send':
            kb_json(200, ['ok' => true, 'wa' => kos_wa_for_bill(kos_int($in['bill_id'] ?? null, 1, PHP_INT_MAX, 'bill_id'), 'resend', $u)]);
        case 'reminders_run':
            kb_json(200, ['ok' => true] + kos_run_reminders($u));
        case 'sim_webhook': {
            // Admin-only stand-in for the gateway while PAYMENT_DRIVER=simulation. It signs a notification and
            // passes it through exactly the same verification and processing as webhook.php.
            if (kos_payment_driver()['name'] !== 'simulation') kos_err(403, 'simulation_disabled', 'Simulasi callback hanya tersedia dalam mode simulasi.');
            $pid = kos_int($in['payment_id'] ?? null, 1, PHP_INT_MAX, 'payment_id');
            $status = (string)($in['status'] ?? '');
            if (!in_array($status, ['success', 'failed', 'expired'], true)) kos_err(422, 'bad_status', 'Status simulasi harus success, failed, atau expired.');
            $p = kb_db()->prepare('SELECT * FROM kos_payments WHERE id = ?'); $p->execute([$pid]); $p = $p->fetch();
            if (!$p || $p['gateway'] !== 'simulation' || !$p['token']) kos_err(404, 'no_payment', 'Link pembayaran simulasi tidak ditemukan.');
            $raw = json_encode(['token' => $p['token'], 'ref' => 'SIM-' . strtoupper(bin2hex(random_bytes(6))), 'status' => $status, 'amount' => (int)$p['amount'], 'timestamp' => time()]);
            kos_audit($u, 'payment.simulate', 'payment', (string)$pid, ['status' => $status]);
            $r = kos_handle_webhook('simulation', $raw, ['x-kb-signature' => kos_sim_sign($raw)]);
            kb_json(200, ['ok' => true] + $r);
        }
        case 'user_create': {
            $name = trim((string)($in['username'] ?? ''));
            $pass = (string)($in['password'] ?? '');
            $role = (string)($in['role'] ?? '');
            if (!kb_valid_username($name)) kos_err(422, 'bad_username', 'Username 3–64 karakter: huruf, angka, titik, strip, atau garis bawah.');
            if (!kb_valid_password($pass)) kos_err(422, 'weak_password', 'Password minimal 10 karakter.');
            if (!in_array($role, KB_ROLES, true)) kos_err(422, 'bad_role', 'Role harus admin atau management.');
            try { kb_db()->prepare('INSERT INTO kb_admins (username, pass_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([$name, password_hash($pass, PASSWORD_DEFAULT), $role, kb_now(), kb_now()]); }
            catch (PDOException $e) { kos_err(409, 'username_taken', 'Username itu sudah dipakai.'); }
            kos_audit($u, 'user.create', 'user', $name, ['role' => $role]);
            kb_json(200, ['ok' => true]);
        }
        case 'user_password': {
            $id = kos_int($in['id'] ?? null, 1, PHP_INT_MAX, 'id');
            $pass = (string)($in['password'] ?? '');
            if (!kb_valid_password($pass)) kos_err(422, 'weak_password', 'Password minimal 10 karakter.');
            $st = kb_db()->prepare('UPDATE kb_admins SET pass_hash = ?, updated_at = ? WHERE id = ?'); $st->execute([password_hash($pass, PASSWORD_DEFAULT), kb_now(), $id]);
            if (!$st->rowCount()) kos_err(404, 'no_user', 'Akun tidak ditemukan.');
            kos_audit($u, 'user.password', 'user', (string)$id, []);
            kb_json(200, ['ok' => true]);
        }
        case 'user_delete': {
            $id = kos_int($in['id'] ?? null, 1, PHP_INT_MAX, 'id');
            if ($id === $u['id']) kos_err(409, 'self', 'Anda tidak bisa menghapus akun yang sedang dipakai.');
            kos_tx(function (PDO $pdo) use ($id, $u) {
                $st = $pdo->prepare('SELECT username, role FROM kb_admins WHERE id = ?'); $st->execute([$id]); $row = $st->fetch();
                if (!$row) kos_err(404, 'no_user', 'Akun tidak ditemukan.');
                if ($row['role'] === 'admin' && kb_admin_count() <= 1) kos_err(409, 'last_admin', 'Harus ada minimal satu admin.');
                $pdo->prepare('DELETE FROM kb_admins WHERE id = ?')->execute([$id]);
                kos_audit($u, 'user.delete', 'user', $row['username'], ['role' => $row['role']]);
            });
            kb_json(200, ['ok' => true]);
        }
    }
    kb_fail(400, 'unknown_action', 'Unknown action.');
} catch (KosError $e) {
    kb_fail($e->status, $e->codeName, $e->getMessage(), $e->extra);
} catch (PDOException $e) {
    kb_fail(500, 'db_error', 'Database menolak perubahan. Tidak ada data yang tersimpan sebagian.');
}

<?php
/**
 * Site content (profile, projects, collection) stored in MySQL.
 *   GET ?rev=N   → { ok, empty } | { ok, unchanged, rev } | { ok, rev, data }
 *   POST         (admin + X-CSRF-Token) { baseRev, data } → { ok, rev }  |  409 { error: "conflict", rev }
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

function kb_site_row(bool $lock = false): ?array
{
    try {
        $sql = 'SELECT rev, data FROM kb_site WHERE id = 1' . ($lock && kb_driver() === 'mysql' ? ' FOR UPDATE' : '');
        $r = kb_db()->query($sql)->fetch();
        return $r ?: null;
    } catch (PDOException $e) {
        return null; // not set up yet: the page keeps using the content built into it
    }
}

if (kb_method() === 'GET') {
    $row = kb_site_row();
    if (!$row) kb_json(200, ['ok' => true, 'empty' => true]);
    $have = isset($_GET['rev']) ? (int)$_GET['rev'] : -1;
    if ((int)$row['rev'] <= $have) kb_json(200, ['ok' => true, 'unchanged' => true, 'rev' => (int)$row['rev']]);
    http_response_code(200);
    kb_headers();
    header('Content-Type: application/json; charset=utf-8');
    // data was validated and encoded by this API when it was saved, so it is sent as stored.
    echo '{"ok":true,"rev":' . (int)$row['rev'] . ',"data":' . $row['data'] . '}';
    exit;
}

if (kb_method() !== 'POST') kb_fail(405, 'method', 'Use GET or POST.');

$admin = kb_require_admin();
$in = kb_body();
$data = $in['data'] ?? null;
$base = (int)($in['baseRev'] ?? -1);
if (!is_array($data) || !isset($data['profile']) || !is_array($data['profile']) || !isset($data['cars']) || !is_array($data['cars'])) {
    kb_fail(422, 'bad_data', 'The site data is incomplete (profile and cars are required).');
}
unset($data['auth'], $data['assetSources']); // never store credentials or build-only fields

$pdo = kb_db();
$pdo->beginTransaction();
try {
    $row = kb_site_row(true);
    $current = $row ? (int)$row['rev'] : 0;
    if ($row && $base !== $current) {
        $pdo->rollBack();
        kb_fail(409, 'conflict', 'Someone saved newer changes. Reload the page to get them, then edit again.', ['rev' => $current]);
    }
    $next = max($current, $base) + 1;
    $data['rev'] = $next;
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || strlen($json) > KB_MAX_BODY) { $pdo->rollBack(); kb_fail(413, 'too_large', 'The site data is over 15 MB. Remove some photos and try again.'); }
    if ($row) {
        $pdo->prepare('UPDATE kb_site SET rev = ?, data = ?, updated_at = ?, updated_by = ? WHERE id = 1')->execute([$next, $json, kb_now(), $admin['username']]);
    } else {
        $pdo->prepare('INSERT INTO kb_site (id, rev, data, updated_at, updated_by) VALUES (1, ?, ?, ?, ?)')->execute([$next, $json, kb_now(), $admin['username']]);
    }
    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    kb_fail(500, 'save_failed', 'The database refused the save. If you added large photos, try smaller ones.');
}
kb_json(200, ['ok' => true, 'rev' => $next]);

<?php
/**
 * Admin session.
 *   GET                       → { ok, configured, admin, role?, username?, csrf? }   (admin = role "admin")
 *   POST ?action=login        { username, password }            → { ok, username, csrf }
 *   POST ?action=logout       (X-CSRF-Token)                    → { ok }
 *   POST ?action=password     { current, username, password }   → { ok, username, csrf }
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$action = (string)($_GET['action'] ?? '');

if (kb_method() === 'GET') {
    kb_ensure_roles();
    $u = kb_user();
    kb_json(200, ['ok' => true, 'configured' => kb_admin_count() > 0, 'admin' => $u !== null && $u['role'] === 'admin'] + ($u ? ['role' => $u['role'], 'username' => $u['username'], 'csrf' => $u['csrf']] : []));
}
if (kb_method() !== 'POST') kb_fail(405, 'method', 'Use GET or POST.');

if ($action === 'login') {
    kb_same_origin();
    if (kb_admin_count() === 0) kb_fail(503, 'not_configured', 'Admin sign-in is not set up yet. Open api/setup.php first.');
    $wait = kb_locked_for();
    if ($wait > 0) kb_fail(429, 'locked', 'Too many failed attempts. Try again in a few minutes.', ['retry_after' => $wait]);

    kb_ensure_roles();
    $in = kb_body();
    $user = trim((string)($in['username'] ?? ''));
    $pass = (string)($in['password'] ?? '');
    $st = kb_db()->prepare('SELECT id, username, pass_hash, role FROM kb_admins WHERE username = ?');
    $st->execute([$user]);
    $row = $st->fetch() ?: null;
    // Verify against a dummy hash when the user doesn't exist, so timing doesn't reveal usernames.
    $hash = $row ? $row['pass_hash'] : password_hash('not-a-real-account', PASSWORD_DEFAULT);
    $ok = password_verify($pass, $hash) && $row !== null;
    if (!$ok) {
        $left = kb_record_fail();
        if ($left <= 0) kb_fail(429, 'locked', 'Too many failed attempts. Sign-in is locked for 5 minutes.', ['retry_after' => KB_LOCK_SECONDS]);
        kb_fail(401, 'wrong_credentials', 'Wrong username or password.', ['attempts_left' => $left]);
    }
    kb_clear_fails();
    if (password_needs_rehash($row['pass_hash'], PASSWORD_DEFAULT)) {
        kb_db()->prepare('UPDATE kb_admins SET pass_hash = ?, updated_at = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), kb_now(), $row['id']]);
    }
    kb_session();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int)$row['id'];
    $_SESSION['username'] = $row['username'];
    $_SESSION['role'] = in_array($row['role'], KB_ROLES, true) ? $row['role'] : 'management';
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    $_SESSION['seen'] = time();
    kb_json(200, ['ok' => true, 'username' => $row['username'], 'role' => $_SESSION['role'], 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'logout') {
    kb_require_role(KB_ROLES);
    kb_logout();
    kb_json(200, ['ok' => true]);
}

if ($action === 'password') {
    $a = kb_require_role(KB_ROLES);
    $in = kb_body();
    $current = (string)($in['current'] ?? '');
    $user = trim((string)($in['username'] ?? ''));
    $pass = (string)($in['password'] ?? '');
    if (!kb_valid_username($user)) kb_fail(422, 'bad_username', 'Use 3–64 letters, numbers, dots, dashes or underscores for the username.');
    if (!kb_valid_password($pass)) kb_fail(422, 'weak_password', 'Use at least 10 characters for the password.');
    $st = kb_db()->prepare('SELECT pass_hash FROM kb_admins WHERE id = ?');
    $st->execute([$a['id']]);
    $row = $st->fetch();
    if (!$row || !password_verify($current, $row['pass_hash'])) kb_fail(403, 'wrong_current', 'The current password is wrong.');
    try {
        kb_db()->prepare('UPDATE kb_admins SET username = ?, pass_hash = ?, updated_at = ? WHERE id = ?')->execute([$user, password_hash($pass, PASSWORD_DEFAULT), kb_now(), $a['id']]);
    } catch (PDOException $e) {
        kb_fail(409, 'username_taken', 'That username is already in use.');
    }
    session_regenerate_id(true);
    $_SESSION['username'] = $user;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    kb_json(200, ['ok' => true, 'username' => $user, 'csrf' => $_SESSION['csrf']]);
}

kb_fail(400, 'unknown_action', 'Unknown action.');

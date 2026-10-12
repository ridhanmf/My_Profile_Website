<?php
/**
 * Shared helpers for the site API (Hostinger / any PHP 7.4+ host with MySQL).
 * Not an endpoint: requests for this file are refused here and in .htaccess.
 */
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

const KB_MAX_BODY = 15728640;      // 15 MB: the whole site (with compressed photos) as JSON
const KB_SESSION_IDLE = 1800;      // admin session ends after 30 minutes without activity
const KB_MAX_FAILS = 5;            // failed sign-ins per IP …
const KB_LOCK_SECONDS = 300;       // … within 5 minutes locks that IP for 5 minutes

function kb_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) kb_fail(503, 'not_configured', 'api/config.php is missing. Copy config.example.php to config.php and fill in the database details.');
        $cfg = require $file;
        if (!is_array($cfg)) kb_fail(503, 'not_configured', 'api/config.php must return an array.');
    }
    return $cfg;
}

function kb_db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = kb_config();
    $dsn = $c['dsn'] ?? sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['db_host'] ?? 'localhost', (int)($c['db_port'] ?? 3306), $c['db_name'] ?? '');
    try {
        $pdo = new PDO($dsn, $c['db_user'] ?? null, $c['db_pass'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $e) {
        kb_fail(503, 'db_unavailable', 'Could not connect to the database. Check the details in api/config.php.');
    }
    return $pdo;
}

function kb_driver(): string { return kb_db()->getAttribute(PDO::ATTR_DRIVER_NAME); }

/** Creates the three tables if they don't exist yet (used by setup.php). */
function kb_ensure_schema(): void
{
    $pdo = kb_db();
    if (kb_driver() === 'mysql') {
        $tail = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        $pdo->exec('CREATE TABLE IF NOT EXISTS kb_admins (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE, pass_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)' . $tail);
        $pdo->exec('CREATE TABLE IF NOT EXISTS kb_site (id TINYINT UNSIGNED PRIMARY KEY, rev INT UNSIGNED NOT NULL, data LONGTEXT NOT NULL, updated_at DATETIME NOT NULL, updated_by VARCHAR(64) NULL)' . $tail);
        $pdo->exec('CREATE TABLE IF NOT EXISTS kb_login_attempts (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ip VARCHAR(64) NOT NULL, at INT UNSIGNED NOT NULL, KEY ip_at (ip, at))' . $tail);
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS kb_admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS kb_site (id INTEGER PRIMARY KEY, rev INTEGER NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NULL)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS kb_login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, at INTEGER NOT NULL)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS ip_at ON kb_login_attempts (ip, at)');
    }
}

function kb_now(): string { return gmdate('Y-m-d H:i:s'); }

function kb_headers(): void
{
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: DENY');
}

function kb_json(int $status, array $body): void
{
    http_response_code($status);
    kb_headers();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function kb_fail(int $status, string $code, string $message, array $extra = []): void
{
    kb_json($status, ['ok' => false, 'error' => $code, 'message' => $message] + $extra);
}

function kb_method(): string { return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); }

/** Reads a JSON object from the request body, refusing anything too large or malformed. */
function kb_body(): array
{
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > KB_MAX_BODY) kb_fail(413, 'too_large', 'The site data is over 15 MB. Remove some photos and try again.');
    $raw = (string)file_get_contents('php://input', false, null, 0, KB_MAX_BODY + 1);
    if (strlen($raw) > KB_MAX_BODY) kb_fail(413, 'too_large', 'The site data is over 15 MB. Remove some photos and try again.');
    $data = json_decode($raw, true);
    if (!is_array($data)) kb_fail(400, 'bad_json', 'The request body must be a JSON object.');
    return $data;
}

/** Changing requests must come from this site (the browser sends Origin on POST). */
function kb_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (strcasecmp((string)parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : ''), $host) !== 0) {
        kb_fail(403, 'bad_origin', 'Requests must come from this website.');
    }
}

function kb_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function kb_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('kb_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => kb_https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
}

function kb_logout(): void
{
    kb_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    }
    session_destroy();
}

/** The signed-in admin, or null. Touches the idle timer. */
function kb_admin(): ?array
{
    kb_session();
    if (empty($_SESSION['admin_id'])) return null;
    if (time() - (int)($_SESSION['seen'] ?? 0) > KB_SESSION_IDLE) { kb_logout(); return null; }
    $_SESSION['seen'] = time();
    return ['id' => (int)$_SESSION['admin_id'], 'username' => (string)$_SESSION['username'], 'csrf' => (string)$_SESSION['csrf']];
}

/** For changing requests: a signed-in admin plus the matching CSRF token header. */
function kb_require_admin(): array
{
    kb_same_origin();
    $a = kb_admin();
    if (!$a) kb_fail(401, 'not_signed_in', 'Your admin session ended. Sign in again.');
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($sent === '' || !hash_equals($a['csrf'], $sent)) kb_fail(403, 'bad_csrf', 'The request could not be verified. Reload the page and sign in again.');
    return $a;
}

function kb_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 64); }

/** Seconds until this IP may try again (0 = allowed). */
function kb_locked_for(): int
{
    $since = time() - KB_LOCK_SECONDS;
    $st = kb_db()->prepare('SELECT COUNT(*) AS n, MAX(at) AS last FROM kb_login_attempts WHERE ip = ? AND at > ?');
    $st->execute([kb_ip(), $since]);
    $r = $st->fetch();
    if ((int)$r['n'] < KB_MAX_FAILS) return 0;
    return max(1, (int)$r['last'] + KB_LOCK_SECONDS - time());
}

function kb_record_fail(): int
{
    $pdo = kb_db();
    $pdo->prepare('INSERT INTO kb_login_attempts (ip, at) VALUES (?, ?)')->execute([kb_ip(), time()]);
    $pdo->prepare('DELETE FROM kb_login_attempts WHERE at < ?')->execute([time() - 86400]);
    $st = $pdo->prepare('SELECT COUNT(*) AS n FROM kb_login_attempts WHERE ip = ? AND at > ?');
    $st->execute([kb_ip(), time() - KB_LOCK_SECONDS]);
    return max(0, KB_MAX_FAILS - (int)$st->fetch()['n']);
}

function kb_clear_fails(): void { kb_db()->prepare('DELETE FROM kb_login_attempts WHERE ip = ?')->execute([kb_ip()]); }

function kb_admin_count(): int
{
    try { return (int)kb_db()->query('SELECT COUNT(*) AS n FROM kb_admins')->fetch()['n']; }
    catch (PDOException $e) { return 0; } // tables not created yet
}

function kb_valid_username(string $u): bool { return (bool)preg_match('/^[A-Za-z0-9._-]{3,64}$/', $u); }
function kb_valid_password(string $p): bool { return strlen($p) >= 10 && strlen($p) <= 200; }

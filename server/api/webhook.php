<?php
/**
 * Payment gateway notifications (callback / webhook):  POST webhook.php?gateway=paypro|simulation
 * The body is verified by the gateway driver (signature) before anything changes. Repeated deliveries
 * of the same notification are answered with 200 and processed only once.
 */
declare(strict_types=1);
require __DIR__ . '/_kos.php';

if (kb_method() !== 'POST') kb_fail(405, 'method', 'POST only.');
$gateway = (string)($_GET['gateway'] ?? '');
if (!in_array($gateway, ['paypro', 'simulation'], true)) kb_fail(404, 'unknown_gateway', 'Unknown gateway.');
$raw = (string)file_get_contents('php://input', false, null, 0, 65537);
if (strlen($raw) > 65536) kb_fail(413, 'too_large', 'Payload too large.');
$headers = [];
foreach ($_SERVER as $k => $v) if (strpos($k, 'HTTP_') === 0) $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string)$v;
try {
    kos_ensure_schema();
    $r = kos_handle_webhook($gateway, $raw, $headers);
    kb_json((int)($r['http'] ?? 200), ['ok' => ($r['http'] ?? 200) < 300, 'result' => $r['result'] ?? '', 'reason' => $r['reason'] ?? null]);
} catch (KosError $e) {
    kb_fail($e->status, $e->codeName, $e->getMessage());
} catch (Throwable $e) {
    kb_fail(500, 'error', 'Notification could not be processed; the gateway may retry.');
}

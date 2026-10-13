<?php
/**
 * Payment gateway and WhatsApp drivers. Not an endpoint.
 *
 * Payment drivers (env PAYMENT_DRIVER):
 *   simulation  default. Links open a simulated pay page; a payment only succeeds through a signed
 *               notification (HMAC-SHA256), sent by the admin's "simulate callback" button or a test.
 *               No money moves. Refused automatically when another driver is active.
 *   paypro      adapter for the PayPro gateway. It stays switched off until create_checkout and
 *               verify_webhook below are written against the official API documentation that PayPro
 *               gives you with your merchant account, and the credentials are set (see README).
 *
 * WhatsApp drivers (env WA_DRIVER):
 *   simulation  default. Messages are written to the log with status "simulated"; nothing is sent.
 *   cloud_api   WhatsApp Business Cloud API (Meta, official). Needs WA_CLOUD_TOKEN and WA_PHONE_NUMBER_ID.
 *               Business-initiated messages need an approved template: set WA_TEMPLATE_NAME.
 */
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

/* ================= payments ================= */

/** Set to true only after kos_paypro_create_checkout() and kos_paypro_verify() are implemented from the
    official PayPro API documentation and tested against PayPro's sandbox. */
const KOS_PAYPRO_ADAPTER_IMPLEMENTED = false;
const KOS_PAYPRO_ENV = ['PAYPRO_API_BASE', 'PAYPRO_MERCHANT_ID', 'PAYPRO_API_KEY', 'PAYPRO_WEBHOOK_SECRET'];

function kos_payment_driver(): array
{
    $name = strtolower(kos_env('PAYMENT_DRIVER', 'simulation'));
    if ($name === 'paypro') {
        $missing = array_values(array_filter(KOS_PAYPRO_ENV, fn($k) => kos_env($k) === ''));
        $ready = KOS_PAYPRO_ADAPTER_IMPLEMENTED && !$missing;
        $note = $ready ? 'PayPro aktif.'
            : (!KOS_PAYPRO_ADAPTER_IMPLEMENTED ? 'PayPro belum aktif: adapter di api/_gateways.php belum disesuaikan dengan dokumentasi API resmi PayPro.' : 'PayPro belum aktif: isi ' . implode(', ', $missing) . '.');
        return ['name' => 'paypro', 'ready' => $ready, 'live' => $ready, 'missing' => $missing, 'note' => $note];
    }
    return ['name' => 'simulation', 'ready' => true, 'live' => false, 'missing' => [], 'note' => 'Mode simulasi: link pembayaran membuka halaman simulasi dan tidak ada uang yang berpindah.'];
}

function kos_gateway_create_checkout(string $driver, array $payment, array $bill, array $tenant): array
{
    if ($driver === 'simulation') return ['checkout_url' => null, 'ref' => null];
    if ($driver === 'paypro') return kos_paypro_create_checkout($payment, $bill, $tenant);
    kos_err(503, 'gateway_unknown', 'Payment gateway tidak dikenal.');
    return [];
}

/** Returns ['ok' => bool, 'http' => int, 'reason' => string, 'event' => normalised event or null]. */
function kos_gateway_verify(string $driver, string $raw, array $headers): array
{
    if ($driver === 'simulation') return kos_sim_verify($raw, $headers);
    if ($driver === 'paypro') return kos_paypro_verify($raw, $headers);
    return ['ok' => false, 'http' => 404, 'reason' => 'unknown_gateway', 'event' => null];
}

/* ---------- simulation ---------- */

function kos_sim_secret(): string
{
    $env = kos_env('SIM_WEBHOOK_SECRET');
    if ($env !== '') return $env;
    $r = kb_db()->query("SELECT v FROM kos_settings WHERE k = 'sim_secret'")->fetch();
    return $r ? (string)json_decode($r['v']) : '';
}
function kos_sim_sign(string $raw): string { return 'sha256=' . hash_hmac('sha256', $raw, kos_sim_secret()); }

function kos_sim_verify(string $raw, array $headers): array
{
    if (kos_payment_driver()['name'] !== 'simulation') return ['ok' => false, 'http' => 403, 'reason' => 'simulation_disabled', 'event' => null];
    $sig = (string)($headers['x-kb-signature'] ?? '');
    $secret = kos_sim_secret();
    if ($secret === '' || $sig === '' || !hash_equals(kos_sim_sign($raw), $sig)) return ['ok' => false, 'http' => 401, 'reason' => 'bad_signature', 'event' => null];
    $d = json_decode($raw, true);
    if (!is_array($d)) return ['ok' => false, 'http' => 400, 'reason' => 'bad_json', 'event' => null];
    if (abs(time() - (int)($d['timestamp'] ?? 0)) > 900) return ['ok' => false, 'http' => 401, 'reason' => 'stale_timestamp', 'event' => null];
    $status = (string)($d['status'] ?? '');
    if (!in_array($status, ['pending', 'success', 'failed', 'expired'], true)) return ['ok' => false, 'http' => 422, 'reason' => 'bad_status', 'event' => null];
    if (!is_int($d['amount'] ?? null) || !preg_match('/^[a-f0-9]{40}$/', (string)($d['token'] ?? '')) || !preg_match('/^[A-Za-z0-9_.:-]{4,100}$/', (string)($d['ref'] ?? ''))) {
        return ['ok' => false, 'http' => 422, 'reason' => 'bad_fields', 'event' => null];
    }
    return ['ok' => true, 'http' => 200, 'reason' => '', 'event' => ['ref' => (string)$d['ref'], 'token' => (string)$d['token'], 'status' => $status, 'amount' => (int)$d['amount'], 'method' => 'Simulasi']];
}

/* ---------- PayPro (to be completed from the official documentation) ---------- */

/**
 * Create a hosted checkout for one payment link at PayPro.
 * Contract: return ['checkout_url' => string (the PayPro page the tenant is sent to), 'ref' => ?string (PayPro's id)].
 * Use: kos_env('PAYPRO_API_BASE'), kos_env('PAYPRO_MERCHANT_ID'), kos_env('PAYPRO_API_KEY');
 *      our order id = $payment['token'] (send it as the merchant reference so the callback can be matched);
 *      amount = $payment['amount'] (IDR, integer); expiry = $payment['expires_at'];
 *      callback URL = kos_public_base() . '/api/webhook.php?gateway=paypro'.
 */
function kos_paypro_create_checkout(array $payment, array $bill, array $tenant): array
{
    kos_err(503, 'gateway_not_ready', kos_payment_driver()['note']);
    return [];
}

/**
 * Verify a PayPro notification and normalise it.
 * Contract: check the signature exactly as PayPro documents it (using PAYPRO_WEBHOOK_SECRET, with
 * hash_equals), optionally confirm the status with PayPro's "check transaction" API, then return
 * ['ok' => true, 'http' => 200, 'reason' => '', 'event' => ['ref' => PayPro transaction id,
 *  'token' => our merchant reference, 'status' => success|failed|expired|pending, 'amount' => int IDR,
 *  'method' => string]].
 */
function kos_paypro_verify(string $raw, array $headers): array
{
    return ['ok' => false, 'http' => 501, 'reason' => 'paypro_adapter_not_implemented', 'event' => null];
}

/* ================= WhatsApp ================= */

function kos_wa_driver(): array
{
    $want = strtolower(kos_env('WA_DRIVER', 'simulation'));
    if ($want === 'cloud_api') {
        $missing = array_values(array_filter(['WA_CLOUD_TOKEN', 'WA_PHONE_NUMBER_ID'], fn($k) => kos_env($k) === ''));
        if (!$missing) return ['name' => 'cloud_api', 'ready' => true, 'live' => true, 'missing' => [], 'template' => kos_env('WA_TEMPLATE_NAME'), 'note' => kos_env('WA_TEMPLATE_NAME') === '' ? 'WhatsApp Cloud API aktif tanpa template: pesan teks hanya terkirim jika penghuni membalas chat dalam 24 jam terakhir.' : 'WhatsApp Cloud API aktif dengan template ' . kos_env('WA_TEMPLATE_NAME') . '.'];
        return ['name' => 'simulation', 'ready' => true, 'live' => false, 'missing' => $missing, 'note' => 'WA_DRIVER=cloud_api tetapi ' . implode(', ', $missing) . ' belum diisi, jadi pesan hanya disimulasikan.'];
    }
    return ['name' => 'simulation', 'ready' => true, 'live' => false, 'missing' => [], 'note' => 'Mode simulasi: pesan dicatat di log dan tidak dikirim ke WhatsApp.'];
}

/** Returns ['status' => simulated|sent|failed, 'driver' => string, 'id' => ?string, 'error' => ?string]. */
function kos_wa_send(string $to62, string $body, array $params): array
{
    $d = kos_wa_driver();
    if ($d['name'] !== 'cloud_api') return ['status' => 'simulated', 'driver' => 'simulation'];
    $base = rtrim(kos_env('WA_API_BASE', 'https://graph.facebook.com'), '/');
    $url = $base . '/' . kos_env('WA_API_VERSION', 'v21.0') . '/' . rawurlencode(kos_env('WA_PHONE_NUMBER_ID')) . '/messages';
    $tpl = kos_env('WA_TEMPLATE_NAME');
    $payload = $tpl !== ''
        ? ['messaging_product' => 'whatsapp', 'to' => $to62, 'type' => 'template', 'template' => ['name' => $tpl, 'language' => ['code' => kos_env('WA_TEMPLATE_LANG', 'id')],
            'components' => [['type' => 'body', 'parameters' => array_map(fn($v) => ['type' => 'text', 'text' => (string)$v], array_values([$params['name'], $params['room'], $params['period'], $params['amount'], $params['due'], $params['status'], $params['link']]))]]]]
        : ['messaging_product' => 'whatsapp', 'to' => $to62, 'type' => 'text', 'text' => ['preview_url' => true, 'body' => $body]];
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . kos_env('WA_CLOUD_TOKEN'), 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    $out = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($out === false) return ['status' => 'failed', 'driver' => 'cloud_api', 'error' => 'koneksi gagal: ' . mb_substr($err, 0, 200)];
    $j = json_decode((string)$out, true);
    if ($code >= 200 && $code < 300 && !empty($j['messages'][0]['id'])) return ['status' => 'sent', 'driver' => 'cloud_api', 'id' => (string)$j['messages'][0]['id']];
    return ['status' => 'failed', 'driver' => 'cloud_api', 'error' => mb_substr('HTTP ' . $code . ': ' . (string)($j['error']['message'] ?? $out), 0, 250)];
}

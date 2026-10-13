<?php
/**
 * Copy this file to config.php (same folder) and fill in your database details.
 * Hostinger: hPanel → Databases → MySQL Databases shows the database name, user and host.
 * config.php is private: it is blocked from the web by .htaccess and never committed to git.
 */
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'u123456789_portfolio',   // database name from hPanel
    'db_user' => 'u123456789_admin',       // database user from hPanel
    'db_pass' => 'ISI_PASSWORD_DATABASE',  // the password you set for that user
    // Random secret asked for once by api/setup.php. Use 24+ characters.
    'setup_token' => 'GANTI_DENGAN_TOKEN_ACAK_MINIMAL_24_KARAKTER',

    /* KostBills integrations. Real environment variables (SetEnv in .htaccess or the hosting panel) take
       priority over these values. Leave a value empty to keep that part in simulation mode.
       Never put these values in the source code or in git. */
    'env' => [
        'PUBLIC_BASE_URL' => '',        // e.g. https://ridhanfirdaus.com (used in payment links sent by WhatsApp)
        'CRON_KEY' => '',               // 24+ random characters, for api/cron.php?key=… (not needed for a CLI cron)
        'KOS_DEMO_ENABLED' => '',       // '0' forces the demo visitor role off; empty = use the dashboard setting

        'PAYMENT_DRIVER' => 'simulation', // 'simulation' or 'paypro' (paypro stays off until its adapter is implemented)
        'PAYPRO_API_BASE' => '',
        'PAYPRO_MERCHANT_ID' => '',
        'PAYPRO_API_KEY' => '',
        'PAYPRO_WEBHOOK_SECRET' => '',
        'SIM_WEBHOOK_SECRET' => '',      // optional; otherwise a random secret is generated and kept in the database

        'WA_DRIVER' => 'simulation',     // 'simulation' or 'cloud_api'
        'WA_CLOUD_TOKEN' => '',          // WhatsApp Business Cloud API access token
        'WA_PHONE_NUMBER_ID' => '',
        'WA_API_VERSION' => 'v21.0',
        'WA_TEMPLATE_NAME' => '',        // approved template with 7 body variables (see README)
        'WA_TEMPLATE_LANG' => 'id',
    ],
];

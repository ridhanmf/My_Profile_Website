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
];

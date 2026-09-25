<?php
/* MySQL DATABASE */
define('DB_SERVER', 'mysql');
define('DB_USER', 'sugoigame_user');
define('DB_PASS', 'sugoigame_pass');
define('DB_NAME', 'sugoi_v2');

/* OCEANO */
define('OCEANO_SERVER', 'websocket:9000'); // Porta interna do container

/* PAGSEGURO */
define('PS_ENV', 'sandbox');    // production, sandbox
define('PS_EMAIL', 'felipe.fmedeiros95@gmail.com');
define('PS_TOKEN_SANDBOX', 'C43E8E781D194CAE9E6523999B98DCDE');
define('PS_TOKEN_PRODUCTION', null);

/* STRIPE */
define('STRIPE_TOKEN_PUBLIC', 'pk_test_51P3g3E2MOJ9VSpoai5LwI4JkUndBVEcFqkvUYK7AqocCYAQspnH1hGkx0bBFjUIbQXL5jllocNkUz8ePA7h4ecqD00okPWh5jW');
define('STRIPE_TOKEN_SECRET', '');
define('STRIPE_CLI_WEBHOOK', '');

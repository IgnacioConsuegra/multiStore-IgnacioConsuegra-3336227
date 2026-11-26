<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Content-Type: application/json; charset=UTF-8");

require_once '../config/auth.php';

initSession();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["authenticated" => false]);
    exit();
}

http_response_code(200);
echo json_encode([
    "authenticated" => true,
    "userId" => (int)$_SESSION['user_id'],
    "role" => $_SESSION['role'] ?? 'customer'
]);
?>
<?php
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../controllers/AdminController.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

requireAdmin(); 

$controller = new AdminController($conn);
$controller->getAnalytics();
?>
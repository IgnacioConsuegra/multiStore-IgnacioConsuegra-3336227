<?php
require_once '../config/database.php';
require_once '../controllers/CategoryController.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

$controller = new CategoryController($conn);
$controller->getAll();
?>
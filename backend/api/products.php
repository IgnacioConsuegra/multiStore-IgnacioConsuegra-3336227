<?php
require_once '../config/database.php';
require_once '../controllers/ProductController.php';

$controller = new ProductController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $controller->getById($_GET['id']);
    } else {
        $controller->getAll();
    }
} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
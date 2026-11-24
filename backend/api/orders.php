<?php
require_once '../config/database.php';
require_once '../controllers/OrderController.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

if (empty($_GET['userId'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "userId requerido."]);
    exit();
}

$controller = new OrderController($conn);
$controller->getOrdersByUser($_GET['userId']);
?>
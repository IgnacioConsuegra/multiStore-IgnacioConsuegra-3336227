<?php
require_once '../config/database.php';
require_once '../controllers/OrderController.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || empty($data['userId'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "userId es requerido."]);
    exit();
}

$controller = new OrderController($conn);
$controller->processCheckout($data['userId']);
?>
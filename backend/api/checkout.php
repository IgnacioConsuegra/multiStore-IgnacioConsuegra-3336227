<?php
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../controllers/OrderController.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

requireAuth();

$currentUserId = getCurrentUserId();
$data = json_decode(file_get_contents("php://input"), true);

if (!empty($data['userId']) && (int)$data['userId'] !== $currentUserId) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "No tienes permiso para procesar este pago."]);
    exit();
}

$controller = new OrderController($conn);
$controller->processCheckout($currentUserId);
?>
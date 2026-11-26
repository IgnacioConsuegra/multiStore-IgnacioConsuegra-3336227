<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../controllers/OrderController.php';

$controller = new OrderController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        // Solo administradores consultan el detalle completo de cualquier orden
        requireAdmin();
        $controller->getOrderById($_GET['id']);

    } elseif (!empty($_GET['userId'])) {
        // Un cliente solo puede consultar sus propias órdenes (o un admin las de cualquiera)
        requireAuth();
        $requestedUserId = (int)$_GET['userId'];

        if (!isAdmin() && getCurrentUserId() !== $requestedUserId) {
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "No tienes permiso para ver estas órdenes."]);
            exit();
        }
        $controller->getOrdersByUser($requestedUserId);

    } else {
        // Listar todas las órdenes de la tienda es exclusivo de administradores
        requireAdmin();
        $controller->getAllOrders();
    }

} elseif ($method === 'PUT') {
    requireAdmin();
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || empty($data['orderId']) || empty($data['status'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "orderId y status son requeridos."]);
        exit();
    }
    $controller->updateOrderStatus($data['orderId'], $data['status']);

} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
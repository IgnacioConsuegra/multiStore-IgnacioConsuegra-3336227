<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

require_once '../config/database.php';
require_once '../controllers/OrderController.php';

$controller = new OrderController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $controller->getOrderById($_GET['id']);
    } elseif (!empty($_GET['userId'])) {
        $controller->getOrdersByUser($_GET['userId']);
    } else {
        $controller->getAllOrders();
    }

} elseif ($method === 'PUT') {
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
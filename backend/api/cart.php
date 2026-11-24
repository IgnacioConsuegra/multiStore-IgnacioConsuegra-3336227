<?php
require_once '../config/database.php';
require_once '../controllers/CartController.php';

$controller = new CartController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (empty($_GET['userId'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "userId requerido"]);
        exit();
    }
    $controller->getCartByUser($_GET['userId']);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data || empty($data['userId']) || empty($data['productId'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Datos incompletos."]);
        exit();
    }
    $controller->addItem($data);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data || empty($data['itemId']) || !isset($data['quantity'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "itemId y quantity requeridos."]);
        exit();
    }
    $controller->updateQuantity($data['itemId'], $data['quantity']);

} elseif ($method === 'DELETE') {
    $itemId = $_GET['itemId'] ?? null;

    if (!$itemId) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "itemId requerido."]);
        exit();
    }
    $controller->removeItem($itemId);

} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
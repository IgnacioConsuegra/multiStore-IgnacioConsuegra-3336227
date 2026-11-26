<?php
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../controllers/CartController.php';

requireAuth();

$controller = new CartController($conn);
$method = $_SERVER['REQUEST_METHOD'];
$currentUserId = getCurrentUserId();

function itemBelongsToUser($conn, $itemId, $userId) {
    $stmt = $conn->prepare("SELECT ci.id_carrito_item 
                            FROM carrito_items ci 
                            INNER JOIN carritos c ON ci.id_carrito = c.id_carrito 
                            WHERE ci.id_carrito_item = :itemId AND c.id_usuario = :userId 
                            LIMIT 1");
    $stmt->execute([
        ':itemId' => (int)$itemId,
        ':userId' => (int)$userId
    ]);
    return (bool)$stmt->fetch();
}

if ($method === 'GET') {
    if (!empty($_GET['userId']) && (int)$_GET['userId'] !== $currentUserId) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "No tienes permiso para ver este carrito."]);
        exit();
    }
    $controller->getCartByUser($currentUserId);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data || empty($data['productId'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Datos incompletos."]);
        exit();
    }

    if (!empty($data['userId']) && (int)$data['userId'] !== $currentUserId) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "No tienes permiso para modificar este carrito."]);
        exit();
    }

    $data['userId'] = $currentUserId;
    $controller->addItem($data);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data || empty($data['itemId']) || !isset($data['quantity'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "itemId y quantity requeridos."]);
        exit();
    }

    if (!itemBelongsToUser($conn, $data['itemId'], $currentUserId)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "No tienes permiso para modificar este ítem."]);
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

    if (!itemBelongsToUser($conn, $itemId, $currentUserId)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "No tienes permiso para eliminar este ítem."]);
        exit();
    }

    $controller->removeItem($itemId);

} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
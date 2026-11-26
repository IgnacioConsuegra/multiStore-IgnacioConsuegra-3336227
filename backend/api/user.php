<?php
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../controllers/UserController.php';

requireAuth();

$controller = new UserController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $requestedId = isset($_GET['id']) ? (int)$_GET['id'] : getCurrentUserId();

    if ($requestedId <= 0) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ID de usuario requerido."]);
        exit();
    }

    if (!isAdmin() && getCurrentUserId() !== $requestedId) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "No tienes permiso para ver este perfil."]);
        exit();
    }

    $controller->getById($requestedId);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || empty($data['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Datos incompletos."]);
        exit();
    }

    $targetId = (int)$data['id'];
    if (!isAdmin() && getCurrentUserId() !== $targetId) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "No tienes permiso para modificar este perfil."]);
        exit();
    }

    $controller->update($data);

} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
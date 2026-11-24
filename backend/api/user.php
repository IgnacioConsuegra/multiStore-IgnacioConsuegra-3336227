<?php
require_once '../config/database.php';
require_once '../controllers/UserController.php';

$controller = new UserController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (empty($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ID de usuario requerido."]);
        exit();
    }
    $controller->getById($_GET['id']);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || empty($data['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Datos incompletos."]);
        exit();
    }
    $controller->update($data);

} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
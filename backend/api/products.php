<?php
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../controllers/ProductController.php';

$controller = new ProductController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $controller->getById($_GET['id']);
    } else {
        $controller->getAll();
    }

} elseif ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || empty($data['name'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Datos incompletos para crear producto"]);
        exit();
    }
    $controller->create($data);

} elseif ($method === 'PUT') {
    requireAdmin();
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || empty($data['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ID de producto requerido"]);
        exit();
    }
    $controller->update($data);

} elseif ($method === 'DELETE') {
    requireAdmin();
    if (empty($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ID de producto requerido"]);
        exit();
    }
    $controller->delete($_GET['id']);

} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
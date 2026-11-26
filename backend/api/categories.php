<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

require_once '../config/database.php';
require_once '../controllers/CategoryController.php';

$controller = new CategoryController($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $controller->getAll();

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || empty($data['name'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Datos incompletos para crear la colección."]);
        exit();
    }
    $controller->create($data);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || empty($data['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ID de colección requerido."]);
        exit();
    }
    $controller->update($data);

} elseif ($method === 'DELETE') {
    if (empty($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ID de colección requerido."]);
        exit();
    }
    $controller->delete($_GET['id']);

} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
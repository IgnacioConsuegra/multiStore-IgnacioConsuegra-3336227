<?php
require_once '../config/database.php';
require_once '../controllers/AuthController.php';


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || empty($data['email']) || empty($data['password']) || empty($data['name'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Incomplete registration data."]);
    exit();
}

$authController = new AuthController($conn);
$authController->signup($data);
?>
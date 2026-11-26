<?php
header("Content-Type: application/json; charset=UTF-8");
require_once '../config/auth.php';

initSession();

// Vaciar variables de sesión
$_SESSION = [];

// Eliminar la cookie PHPSESSID del navegador
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

session_destroy();

http_response_code(200);
echo json_encode([
    "status" => "success",
    "message" => "Sesión cerrada correctamente."
]);
?>
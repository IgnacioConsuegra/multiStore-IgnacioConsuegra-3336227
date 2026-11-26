<?php
function initSession() {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        session_start();
    }
}

function requireAuth() {
    initSession();
    if (empty($_SESSION['user_id'])) {
        header("Content-Type: application/json; charset=UTF-8");
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "No autorizado. Debes iniciar sesión."
        ]);
        exit();
    }
}

function requireAdmin() {
    requireAuth();
    if (strtolower($_SESSION['role'] ?? '') !== 'admin') {
        header("Content-Type: application/json; charset=UTF-8");
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Acceso denegado. Se requieren permisos de administrador."
        ]);
        exit();
    }
}

function getCurrentUserId() {
    initSession();
    return (int)($_SESSION['user_id'] ?? 0);
}

function isAdmin() {
    initSession();
    return strtolower($_SESSION['role'] ?? '') === 'admin';
}
?>
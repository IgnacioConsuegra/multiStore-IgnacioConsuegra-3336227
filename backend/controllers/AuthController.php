<?php
class AuthController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function signup($data) {
        // 1. Verificar si el correo ya existe en la tabla 'usuarios'
        $checkQuery = "SELECT id_usuario FROM usuarios WHERE email = :email LIMIT 1";
        $checkStmt = $this->conn->prepare($checkQuery);
        $checkStmt->bindParam(':email', $data['email']);
        $checkStmt->execute();

        if ($checkStmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "An account with this email already exists."
            ]);
            return;
        }

        // 2. Insertar en 'usuarios' con los nombres de columnas exactos de mystore.sql
        $query = "INSERT INTO usuarios 
                  (nombre, email, password, calle, ciudad, estado_region, codigo_postal, pais, telefono, rol) 
                  VALUES 
                  (:nombre, :email, :password, :calle, :ciudad, :estado_region, :codigo_postal, :pais, :telefono, :rol)";

        $stmt = $this->conn->prepare($query);

        $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);
        $rol = 'customer'; // En minúsculas, tal como lo exige tu ENUM('customer','admin')

        $stmt->bindParam(':nombre', $data['name']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':password', $hashedPassword);
        $stmt->bindParam(':calle', $data['address']['street']);
        $stmt->bindParam(':ciudad', $data['address']['city']);
        $stmt->bindParam(':estado_region', $data['address']['state']);
        $stmt->bindParam(':codigo_postal', $data['address']['zipCode']);
        $stmt->bindParam(':pais', $data['address']['country']);
        $stmt->bindParam(':telefono', $data['phone']);
        $stmt->bindParam(':rol', $rol);

        if ($stmt->execute()) {
            // Obtenemos el ID autoincremental generado por MySQL
            $newId = $this->conn->lastInsertId();

            // Estructuramos el usuario para el frontend (sin password)
            $userResponse = [
                "id" => $newId,
                "name" => $data['name'],
                "email" => $data['email'],
                "phone" => $data['phone'],
                "address" => $data['address'],
                "role" => "Customer" // Capitalizado para la interfaz si lo deseas
            ];

            http_response_code(201);
            echo json_encode([
                "status" => "success",
                "message" => "Account created successfully!",
                "user" => $userResponse
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Failed to register user in database."
            ]);
        }
    }

    public function login($data) {
        // 1. Buscar el usuario por correo electrónico
        $query = "SELECT * FROM usuarios WHERE email = :email LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $data['email']);
        $stmt->execute();

        $user = $stmt->fetch();

        // 2. Verificar si existe y si la contraseña coincide con el hash guardado
        if ($user && password_verify($data['password'], $user['password'])) {
            
            // Mapear las columnas de MySQL al formato que espera el frontend
            $userResponse = [
                "id" => $user['id_usuario'],
                "name" => $user['nombre'],
                "email" => $user['email'],
                "phone" => $user['telefono'],
                "address" => [
                    "street" => $user['calle'],
                    "city" => $user['ciudad'],
                    "state" => $user['estado_region'],
                    "zipCode" => $user['codigo_postal'],
                    "country" => $user['pais']
                ],
                // Convierte 'admin' -> 'Admin' y 'customer' -> 'Customer'
                "role" => ucfirst($user['rol'])
            ];

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "Login successful!",
                "user" => $userResponse
            ]);
        } else {
            http_response_code(401);
            echo json_encode([
                "status" => "error",
                "message" => "Correo electrónico o contraseña incorrectos."
            ]);
        }
    }
}
?>
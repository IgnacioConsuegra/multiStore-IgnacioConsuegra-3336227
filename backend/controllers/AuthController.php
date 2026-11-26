<?php
require_once __DIR__ . '/../config/auth.php';

class AuthController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function signup($data) {
        $name = trim($data['name'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $phone = trim($data['phone'] ?? '');
        $password = $data['password'] ?? '';
        $street = trim($data['address']['street'] ?? '');
        $city = trim($data['address']['city'] ?? '');
        $state = trim($data['address']['state'] ?? '');
        $zipCode = trim($data['address']['zipCode'] ?? '');
        $country = trim($data['address']['country'] ?? '');

        if (!preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $name)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid full name."]);
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid email format."]);
            return;
        }

        if (!preg_match("/^[0-9]{7,15}$/", $phone)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Phone number must contain 7 to 15 digits only."]);
            return;
        }

        if (strlen($street) < 5 || !preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $city) ||
            !preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $state) ||
            !preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $country) ||
            !preg_match("/^[a-zA-Z0-9\s-]{3,12}$/", $zipCode)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid address details."]);
            return;
        }

        if (strlen($password) < 8 || !preg_match("/[a-zA-Z]/", $password) || !preg_match("/[0-9]/", $password)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Password must be at least 8 characters with letters and numbers."]);
            return;
        }
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

        // 2. Insertar en 'usuarios'
        $query = "INSERT INTO usuarios 
                  (nombre, email, password, calle, ciudad, estado_region, codigo_postal, pais, telefono, rol) 
                  VALUES 
                  (:nombre, :email, :password, :calle, :ciudad, :estado_region, :codigo_postal, :pais, :telefono, :rol)";

        $stmt = $this->conn->prepare($query);

        $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);
        $rol = 'customer';

        $street = $data['address']['street'] ?? '';
        $city = $data['address']['city'] ?? '';
        $state = $data['address']['state'] ?? '';
        $zipCode = $data['address']['zipCode'] ?? '';
        $country = $data['address']['country'] ?? '';
        $phone = $data['phone'] ?? '';

        $stmt->bindParam(':nombre', $data['name']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':password', $hashedPassword);
        $stmt->bindParam(':calle', $street);
        $stmt->bindParam(':ciudad', $city);
        $stmt->bindParam(':estado_region', $state);
        $stmt->bindParam(':codigo_postal', $zipCode);
        $stmt->bindParam(':pais', $country);
        $stmt->bindParam(':telefono', $phone);
        $stmt->bindParam(':rol', $rol);

        if ($stmt->execute()) {
            $newId = (int)$this->conn->lastInsertId();

            // 3. Crear sesión segura en el servidor
            initSession();
            session_regenerate_id(true);
            $_SESSION['user_id'] = $newId;
            $_SESSION['role'] = $rol;

            $userResponse = [
                "id" => (string)$newId,
                "name" => $data['name'],
                "email" => $data['email'],
                "phone" => $phone,
                "address" => [
                    "street" => $street,
                    "city" => $city,
                    "state" => $state,
                    "zipCode" => $zipCode,
                    "country" => $country
                ],
                "role" => "Customer"
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

        // 2. Verificar contraseña
        if ($user && password_verify($data['password'], $user['password'])) {
            $rolNormalizado = strtolower($user['rol']);

            // 3. Crear sesión segura en el servidor
            initSession();
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)$user['id_usuario'];
            $_SESSION['role'] = $rolNormalizado;

            $userResponse = [
                "id" => (string)$user['id_usuario'],
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
                "role" => ucfirst($rolNormalizado)
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
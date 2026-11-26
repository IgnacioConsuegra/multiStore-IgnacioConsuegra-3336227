<?php
class UserController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getById($id) {
        $query = "SELECT id_usuario, nombre, email, telefono, rol, calle, ciudad, estado_region, codigo_postal, pais 
                  FROM usuarios 
                  WHERE id_usuario = :id 
                  LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch();

        if ($row) {
            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "user" => $this->formatUser($row)
            ]);
        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Usuario no encontrado."]);
        }
    }

    public function update($data) {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "ID de usuario inválido."]);
            return;
        }

        // Normalizar espacios
        $nombre = preg_replace('/\s+/', ' ', trim($data['name'] ?? ''));
        $telefono = trim($data['phone'] ?? '');
        $address = is_array($data['address'] ?? null) ? $data['address'] : [];
        $calle = preg_replace('/\s+/', ' ', trim($address['street'] ?? ''));
        $ciudad = preg_replace('/\s+/', ' ', trim($address['city'] ?? ''));
        $estado = preg_replace('/\s+/', ' ', trim($address['state'] ?? ''));
        $cp = trim($address['zipCode'] ?? '');
        $pais = preg_replace('/\s+/', ' ', trim($address['country'] ?? ''));

        // 1. Validar Nombre (solo letras, espacios y signos básicos de nombre)
        if (!preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $nombre)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El nombre debe contener solo letras (2 a 100 caracteres)."]);
            return;
        }

        // 2. Validar Teléfono (estrictamente solo números, de 7 a 15 dígitos)
        if (!preg_match("/^[0-9]{7,15}$/", $telefono)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El teléfono debe contener únicamente entre 7 y 15 dígitos numéricos."]);
            return;
        }

        // 3. Validar Código Postal (estrictamente solo números, de 3 a 10 dígitos)
        if (!preg_match("/^[0-9]{3,10}$/", $cp)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El código postal (Zip Code) debe contener únicamente entre 3 y 10 números."]);
            return;
        }

        // 4. Validar Calle, Ciudad, Estado y País
        if (mb_strlen($calle) < 5 || mb_strlen($calle) > 150) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "La dirección de calle debe tener entre 5 y 150 caracteres."]);
            return;
        }

        if (!preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $ciudad) ||
            !preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $estado) ||
            !preg_match("/^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/u", $pais)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Ciudad, estado y país deben contener únicamente texto válido sin números."]);
            return;
        }

        $query = "UPDATE usuarios 
                  SET nombre = :nombre,
                      telefono = :telefono,
                      calle = :calle,
                      ciudad = :ciudad,
                      estado_region = :estado,
                      codigo_postal = :cp,
                      pais = :pais
                  WHERE id_usuario = :id";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':nombre', $nombre);
        $stmt->bindParam(':telefono', $telefono);
        $stmt->bindParam(':calle', $calle);
        $stmt->bindParam(':ciudad', $ciudad);
        $stmt->bindParam(':estado', $estado);
        $stmt->bindParam(':cp', $cp);
        $stmt->bindParam(':pais', $pais);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);

        if ($stmt->execute()) {
            $this->getById($id);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo actualizar el perfil."]);
        }
    }

    private function formatUser($row) {
        return [
            "id" => (string)$row['id_usuario'],
            "name" => $row['nombre'],
            "email" => $row['email'],
            "phone" => $row['telefono'] ?? '',
            "role" => $row['rol'] ?? 'customer',
            "address" => [
                "street" => $row['calle'] ?? '',
                "city" => $row['ciudad'] ?? '',
                "state" => $row['estado_region'] ?? '',
                "zipCode" => $row['codigo_postal'] ?? '',
                "country" => $row['pais'] ?? ''
            ]
        ];
    }
}
?>
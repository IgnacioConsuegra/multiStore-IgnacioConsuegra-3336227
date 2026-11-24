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

        $nombre = trim($data['name'] ?? '');
        $telefono = trim($data['phone'] ?? '');
        $address = $data['address'] ?? [];
        $calle = trim($address['street'] ?? '');
        $ciudad = trim($address['city'] ?? '');
        $estado = trim($address['state'] ?? '');
        $cp = trim($address['zipCode'] ?? '');
        $pais = trim($address['country'] ?? '');

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
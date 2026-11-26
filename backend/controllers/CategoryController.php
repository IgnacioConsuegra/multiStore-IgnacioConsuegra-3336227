<?php
class CategoryController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAll() {
        $totalStmt = $this->conn->query("SELECT COUNT(*) AS total FROM productos");
        $totalAllProducts = (int)$totalStmt->fetch()['total'];

        $query = "SELECT 
                    c.id_categoria,
                    c.nombre,
                    c.descripcion,
                    c.foto,
                    c.porcentaje_descuento,
                    c.icono,
                    COUNT(DISTINCT pc.id_producto) AS total_items
                  FROM categorias c
                  LEFT JOIN producto_categorias pc ON c.id_categoria = pc.id_categoria
                  GROUP BY c.id_categoria
                  ORDER BY (LOWER(c.nombre) = 'all') DESC, c.id_categoria ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $categories = array_map(function ($row) use ($totalAllProducts) {
            $isAll = strtolower(trim($row['nombre'])) === 'all';

            return [
                "id" => (string)$row['id_categoria'],
                "name" => $row['nombre'],
                "description" => $row['descripcion'] ?? '',
                "image" => $row['foto'] ?? '',
                "discount" => (float)($row['porcentaje_descuento'] ?? 0),
                "icon" => !empty($row['icono']) ? $row['icono'] : 'fa-solid fa-layer-group',
                "count" => $isAll ? $totalAllProducts : (int)$row['total_items']
            ];
        }, $rows);

        http_response_code(200);
        echo json_encode($categories);
    }

    public function create($data) {
        $nombre = trim($data['name'] ?? '');
        if ($nombre === '') {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El nombre de la colección es obligatorio."]);
            return;
        }

        // Verificar duplicados
        $checkStmt = $this->conn->prepare("SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER(:nombre) LIMIT 1");
        $checkStmt->execute([':nombre' => $nombre]);
        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Ya existe una colección con ese nombre."]);
            return;
        }

        $descripcion = trim($data['description'] ?? '');
        $descripcion = $descripcion !== '' ? $descripcion : null;

        $foto = trim($data['image'] ?? '');
        $foto = $foto !== '' ? $foto : null;

        $descuento = isset($data['discount']) && $data['discount'] !== ''
            ? max(0, min(100, round((float)str_replace(',', '.', (string)$data['discount']), 2)))
            : 0.00;

        $icono = trim($data['icon'] ?? '');
        $icono = $icono !== '' ? $icono : 'fa-solid fa-layer-group';

        $query = "INSERT INTO categorias (nombre, descripcion, foto, porcentaje_descuento, icono)
                  VALUES (:nombre, :descripcion, :foto, :descuento, :icono)";
        $stmt = $this->conn->prepare($query);
        $stmt->bindValue(':nombre', $nombre);
        $stmt->bindValue(':descripcion', $descripcion, $descripcion === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':foto', $foto, $foto === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':descuento', $descuento);
        $stmt->bindValue(':icono', $icono);

        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode([
                "status" => "success",
                "message" => "Colección creada correctamente.",
                "id" => $this->conn->lastInsertId()
            ]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo crear la colección."]);
        }
    }

    public function update($data) {
        $id = (int)($data['id'] ?? 0);
        $nombre = trim($data['name'] ?? '');

        if ($id <= 0 || $nombre === '') {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "ID y nombre de colección son obligatorios."]);
            return;
        }

        // Comprobar si es la colección base 'All' para proteger su nombre
        $currStmt = $this->conn->prepare("SELECT nombre FROM categorias WHERE id_categoria = :id LIMIT 1");
        $currStmt->execute([':id' => $id]);
        $current = $currStmt->fetch();

        if (!$current) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Colección no encontrada."]);
            return;
        }

        if (strtolower(trim($current['nombre'])) === 'all') {
            $nombre = 'All';
        } else {
            $dupStmt = $this->conn->prepare("SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER(:nombre) AND id_categoria != :id LIMIT 1");
            $dupStmt->execute([':nombre' => $nombre, ':id' => $id]);
            if ($dupStmt->fetch()) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Ya existe otra colección con ese nombre."]);
                return;
            }
        }

        $descripcion = trim($data['description'] ?? '');
        $descripcion = $descripcion !== '' ? $descripcion : null;

        $foto = trim($data['image'] ?? '');
        $foto = $foto !== '' ? $foto : null;

        $descuento = isset($data['discount']) && $data['discount'] !== ''
            ? max(0, min(100, round((float)str_replace(',', '.', (string)$data['discount']), 2)))
            : 0.00;

        $icono = trim($data['icon'] ?? '');
        $icono = $icono !== '' ? $icono : 'fa-solid fa-layer-group';

        $query = "UPDATE categorias
                  SET nombre = :nombre,
                      descripcion = :descripcion,
                      foto = :foto,
                      porcentaje_descuento = :descuento,
                      icono = :icono
                  WHERE id_categoria = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindValue(':nombre', $nombre);
        $stmt->bindValue(':descripcion', $descripcion, $descripcion === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':foto', $foto, $foto === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':descuento', $descuento);
        $stmt->bindValue(':icono', $icono);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "Colección actualizada correctamente."
            ]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo actualizar la colección."]);
        }
    }

    public function delete($id) {
        $id = (int)$id;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "ID inválido."]);
            return;
        }

        $currStmt = $this->conn->prepare("SELECT nombre FROM categorias WHERE id_categoria = :id LIMIT 1");
        $currStmt->execute([':id' => $id]);
        $current = $currStmt->fetch();

        if (!$current) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Colección no encontrada."]);
            return;
        }

        if (strtolower(trim($current['nombre'])) === 'all') {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "La colección por defecto 'All' no se puede eliminar."]);
            return;
        }

        try {
            $this->conn->beginTransaction();

            $delRel = $this->conn->prepare("DELETE FROM producto_categorias WHERE id_categoria = :id");
            $delRel->execute([':id' => $id]);

            $delCat = $this->conn->prepare("DELETE FROM categorias WHERE id_categoria = :id");
            $delCat->execute([':id' => $id]);

            $this->conn->commit();

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "Colección eliminada correctamente."
            ]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Error eliminando colección: " . $e->getMessage()
            ]);
        }
    }
}
?>
<?php
class CategoryController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAll() {
        $totalStmt = $this->conn->query("SELECT COUNT(*) as total FROM productos");
        $totalAllProducts = (int)$totalStmt->fetch()['total'];

        // Consultar categorías y contar los productos asociados a cada una
        $query = "SELECT 
            c.id_categoria,
            c.nombre,
            c.descripcion,
            c.foto,
            c.porcentaje_descuento,
            c.icono,
            COUNT(pc.id_producto) AS total_items
          FROM categorias c
          LEFT JOIN producto_categorias pc ON c.id_categoria = pc.id_categoria
          GROUP BY c.id_categoria
          ORDER BY (c.nombre = 'All') DESC, c.id_categoria ASC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $categories = array_map(function($row) use ($totalAllProducts) {
            $isAll = strtolower($row['nombre']) === 'all';
            
            return [
                "id" => (string)$row['id_categoria'],
                "name" => $row['nombre'],
                "description" => $row['descripcion'],
                "image" => $row['foto'],
                "discount" => (float)$row['porcentaje_descuento'],
                "icon" => $row['icono'] ?: 'fa-solid fa-tag',
                "count" => $isAll ? $totalAllProducts : (int)$row['total_items']
            ];
        }, $rows);

        http_response_code(200);
        echo json_encode($categories);
    }
}
?>
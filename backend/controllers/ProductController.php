<?php
class ProductController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAll() {
        $query = "SELECT 
                    p.id_producto, 
                    p.nombre, 
                    p.descripcion, 
                    p.precio_base, 
                    p.imagenes_base, 
                    p.destacado, 
                    p.opciones,
                    c.nombre AS categoria,
                    COALESCE(SUM(pv.stock), 0) AS stock_total
                  FROM productos p
                  LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
                  LEFT JOIN producto_variantes pv ON p.id_producto = pv.id_producto
                  GROUP BY p.id_producto
                  ORDER BY p.id_producto ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $products = array_map([$this, 'formatProduct'], $rows);

        http_response_code(200);
        echo json_encode($products);
    }

    public function getById($id) {
        $query = "SELECT 
                    p.id_producto, 
                    p.nombre, 
                    p.descripcion, 
                    p.precio_base, 
                    p.imagenes_base, 
                    p.destacado, 
                    p.opciones,
                    c.nombre AS categoria,
                    COALESCE(SUM(pv.stock), 0) AS stock_total
                  FROM productos p
                  LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
                  LEFT JOIN producto_variantes pv ON p.id_producto = pv.id_producto
                  WHERE p.id_producto = :id
                  GROUP BY p.id_producto
                  LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $row = $stmt->fetch();

        if ($row) {
            http_response_code(200);
            echo json_encode($this->formatProduct($row));
        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Producto no encontrado"]);
        }
    }

    // Mapea la fila de MySQL al formato exacto que espera el Frontend
    private function formatProduct($row) {
        $imagenes = json_decode($row['imagenes_base'], true) ?: [];
        $opciones = json_decode($row['opciones'], true) ?: [];

        $sizes = [];
        $colors = [];
        $materials = [];

        foreach ($opciones as $opt) {
            $name = strtolower($opt['name'] ?? '');
            if ($name === 'size' || $name === 'talla') $sizes = $opt['values'] ?? [];
            if ($name === 'color') $colors = $opt['values'] ?? [];
            if ($name === 'material') $materials = $opt['values'] ?? [];
        }

        return [
            "id" => (string)$row['id_producto'],
            "name" => $row['nombre'],
            "price" => (float)$row['precio_base'],
            "image" => $imagenes[0] ?? '',
            "description" => $row['descripcion'],
            "category" => $row['categoria'] ?? 'Uncategorized',
            "stock" => (int)$row['stock_total'],
            "featured" => (bool)$row['destacado'],
            "sizes" => $sizes,
            "colors" => $colors,
            "materials" => $materials
        ];
    }
}
?>